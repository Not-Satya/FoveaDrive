# backend/processing/terrain.py

from typing import List, Dict

from config import TERRAIN_CONFIG
from data.semantics import terrain_from_semantic


def classify_terrain(grid_data: List[Dict]) -> List[Dict]:
    """
    Classify each grid cell as 'depression', 'obstacle', 'rough', or 'ground'.

    Default is geometric (signed height + roughness). SemanticKITTI majority
    class is optional and off by default so drivability is not GT-label lookup.
    """
    h_thresh = TERRAIN_CONFIG["height_threshold"]
    r_thresh = TERRAIN_CONFIG["roughness_threshold"]
    d_thresh = TERRAIN_CONFIG["depression_threshold"]
    use_semantics = TERRAIN_CONFIG.get("use_semantics", False)

    for cell in grid_data:
        h = cell["height"]
        std = cell["height_std"]
        sem = cell.get("semantic")
        if use_semantics and sem is not None:
            mapped = terrain_from_semantic(
                sem, h, std,
                cell.get("obstacle_frac", 0.0),
                h_thresh, r_thresh, d_thresh,
            )
            if mapped is not None:
                cell["terrain"] = mapped
                continue

        if h < d_thresh:
            cell["terrain"] = "depression"
        elif h > h_thresh:
            cell["terrain"] = "obstacle"
        elif std > r_thresh:
            cell["terrain"] = "rough"
        else:
            cell["terrain"] = "ground"

    return grid_data
