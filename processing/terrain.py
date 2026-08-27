# backend/processing/terrain.py

from typing import List, Dict

import numpy as np

from config import TERRAIN_CONFIG
from data.semantics import ROAD_CLASSES, terrain_from_semantic


def _fit_ground_plane(grid_data: List[Dict]) -> np.ndarray | None:
    """
    Least-squares plane z = ax + by + c through road-like cells.

    KITTI patches often slope 1–2% over 20 m. Measuring height from Z=0 at the
    sensor then makes a drivable grade look taller than sedan clearance.
    """
    xs: list[float] = []
    ys: list[float] = []
    zs: list[float] = []
    for cell in grid_data:
        if cell.get("point_count", 0) < 5:
            continue
        if cell.get("height_std", 1.0) > 0.12:
            continue
        h = float(cell["height"])
        if abs(h) > 0.6:
            continue
        sem = cell.get("semantic")
        road = sem in ROAD_CLASSES if sem is not None else cell.get("zone") in ("near", "mid")
        if not road:
            continue
        xs.append(float(cell["x"]))
        ys.append(float(cell["y"]))
        zs.append(h)
    if len(xs) < 24:
        return None
    A = np.column_stack([xs, ys, np.ones(len(xs))])
    coef, *_ = np.linalg.lstsq(A, np.asarray(zs, dtype=np.float64), rcond=None)
    max_grade = float(TERRAIN_CONFIG.get("max_grade", 0.12))
    coef[0] = float(np.clip(coef[0], -max_grade, max_grade))
    coef[1] = float(np.clip(coef[1], -max_grade, max_grade))
    return coef


def _relative_height(cell: Dict, plane: np.ndarray | None) -> float:
    h = float(cell["height"])
    if plane is None:
        return h
    return h - (plane[0] * float(cell["x"]) + plane[1] * float(cell["y"]) + plane[2])


def classify_terrain(grid_data: List[Dict]) -> List[Dict]:
    """
    Classify each grid cell as 'depression', 'obstacle', 'rough', or 'ground'.

    Default is geometric (signed height + roughness vs a local ground plane).
    SemanticKITTI majority class is optional and off by default so drivability
    is not GT-label lookup.
    """
    h_thresh = TERRAIN_CONFIG["height_threshold"]
    r_thresh = TERRAIN_CONFIG["roughness_threshold"]
    d_thresh = TERRAIN_CONFIG["depression_threshold"]
    use_semantics = TERRAIN_CONFIG.get("use_semantics", False)
    min_pts = int(TERRAIN_CONFIG.get("min_obstacle_points", 4))
    flyer_range = float(TERRAIN_CONFIG.get("flyer_range", 5.0))
    plane = _fit_ground_plane(grid_data)

    for cell in grid_data:
        h = _relative_height(cell, plane)
        cell["height_rel"] = round(h, 4)
        std = cell["height_std"]
        sem = cell.get("semantic")
        dist = (float(cell["x"]) ** 2 + float(cell["y"]) ** 2) ** 0.5
        sparse_flyer = (
            cell.get("point_count", 0) < min_pts
            and dist < flyer_range
            and h > h_thresh
        )

        if use_semantics and sem is not None:
            mapped = terrain_from_semantic(
                sem, h, std,
                cell.get("obstacle_frac", 0.0),
                h_thresh, r_thresh, d_thresh,
            )
            if mapped is not None:
                if sparse_flyer and mapped == "obstacle":
                    cell["terrain"] = "ground"
                else:
                    cell["terrain"] = mapped
                continue

        if sparse_flyer:
            cell["terrain"] = "ground"
        elif h < d_thresh:
            cell["terrain"] = "depression"
        elif h > h_thresh:
            cell["terrain"] = "obstacle"
        elif std > r_thresh:
            cell["terrain"] = "rough"
        else:
            cell["terrain"] = "ground"

    return grid_data
