# backend/data/loader.py

import json
from pathlib import Path

import numpy as np

from data.semantics import ROAD_CLASSES


DATASET_DIR = Path(__file__).parent / "lidar"
_CATALOG: dict | None = None
_COMPACT_FRAMES: list[dict] | None = None


# ---------------------------------------------------------------------------
# Synthetic data generator  (fallback — no hardware needed)
# ---------------------------------------------------------------------------

def load_sample_points(num_points: int = 6000, seed: int = 42) -> np.ndarray:
    """
    Generate a realistic-looking synthetic point cloud (N x 3, dtype float32).

    Layout (vehicle at origin, X = forward, Y = lateral, Z = up):
      - Flat ground plane across 50 x 50 m
      - Potholes (negative Z) carved into the ground
      - 6 obstacle clusters at varying distances/sizes
      - Scattered "rough patch" points between zones
    """
    rng = np.random.default_rng(seed)

    n_ground = int(num_points * 0.62)
    ground_xy = rng.uniform(-25, 25, (n_ground, 2))
    ground_z  = rng.uniform(0.0, 0.12, (n_ground, 1))

    pothole_specs = [
        (  7.5, -2.5, 1.4, -0.58, -0.32),
        (  3.0,  5.0, 0.9, -0.22, -0.10),
        ( 16.0,  3.5, 1.6, -0.72, -0.40),
        ( 11.0, -7.0, 1.1, -0.38, -0.18),
    ]
    for cx, cy, radius, zlo, zhi in pothole_specs:
        d = np.hypot(ground_xy[:, 0] - cx, ground_xy[:, 1] - cy)
        mask = d < radius
        n = int(mask.sum())
        if n:
            ground_z[mask, 0] = rng.uniform(zlo, zhi, n)

    ground = np.hstack([ground_xy, ground_z])

    pothole_parts = []
    for cx, cy, radius, zlo, zhi in pothole_specs:
        n = 140
        ang = rng.uniform(0, 2 * np.pi, n)
        rad = np.sqrt(rng.uniform(0, 1, n)) * radius
        px = cx + rad * np.cos(ang)
        py = cy + rad * np.sin(ang)
        pz = rng.uniform(zlo, zhi, n)
        pothole_parts.append(np.column_stack([px, py, pz]))
    potholes = np.vstack(pothole_parts)

    obstacle_specs = [
        (  5.0,  2.0,  0.8, 0.6, 1.8, 120),
        ( -4.0,  3.5,  0.6, 0.5, 1.2, 100),
        ( 18.0, -5.0,  1.5, 0.8, 2.5, 200),
        ( 25.0,  8.0,  2.0, 1.0, 3.5, 220),
        ( 40.0,  0.0,  3.0, 0.6, 4.0, 250),
        (-20.0, 12.0,  2.5, 0.5, 2.0, 180),
    ]

    obstacle_parts = []
    for (cx, cy, spread, zlo, zhi, n) in obstacle_specs:
        ox = rng.normal(cx, spread, (n, 1))
        oy = rng.normal(cy, spread, (n, 1))
        oz = rng.uniform(zlo, zhi, (n, 1))
        obstacle_parts.append(np.hstack([ox, oy, oz]))
    obstacles = np.vstack(obstacle_parts)

    n_rough = num_points - n_ground - len(obstacles)
    rough_xy = rng.uniform(-20, 20, (n_rough, 2))
    dist = np.linalg.norm(rough_xy, axis=1)
    mask = (dist > 10) & (dist < 30)
    rough_xy = rough_xy[mask][:n_rough]
    rough_z  = rng.uniform(0.2, 0.45, (len(rough_xy), 1))
    rough    = np.hstack([rough_xy, rough_z])

    cloud = np.vstack([ground, potholes, obstacles, rough]).astype(np.float32)
    return cloud


# ---------------------------------------------------------------------------
# KITTI / SemanticKITTI loaders
# ---------------------------------------------------------------------------

def load_kitti_bin(filepath: str | Path) -> np.ndarray:
    """KITTI Velodyne .bin → (N, 3) xyz. Intensity is dropped."""
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Point cloud file not found: {path}")
    raw = np.fromfile(str(path), dtype=np.float32).reshape(-1, 4)
    return raw[:, :3]


def load_semantic_labels(frame_id: str) -> np.ndarray | None:
    """SemanticKITTI .label → (N,) uint32 semantic class (lower 16 bits)."""
    path = DATASET_DIR / "labels" / f"{frame_id}.label"
    if not path.exists():
        return None
    raw = np.fromfile(str(path), dtype=np.uint32)
    return (raw & np.uint32(0xFFFF)).astype(np.int32)


def list_frames() -> list[str]:
    """Sorted canonical ids present on disk, e.g. 'frame_000000'."""
    raw_dir = DATASET_DIR / "raw"
    if not raw_dir.exists():
        return []
    return sorted(p.stem for p in raw_dir.glob("*.bin"))


def raw_point_count(frame_id: str) -> int:
    path = DATASET_DIR / "raw" / f"{frame_id}.bin"
    if not path.exists():
        return 0
    return path.stat().st_size // 16


def _estimate_ground_z(pts: np.ndarray, labels: np.ndarray | None) -> float:
    """Road-class median when labels exist; otherwise a low percentile of near points."""
    if labels is not None and len(labels) == len(pts):
        road = np.isin(labels, tuple(ROAD_CLASSES))
        if int(road.sum()) >= 50:
            return float(np.median(pts[road, 2]))
    near = np.hypot(pts[:, 0], pts[:, 1]) < 30.0
    sample = pts[near] if near.any() else pts
    return float(np.percentile(sample[:, 2], 15))


def load_frame(
    frame_id: str = "frame_000000",
    normalize_ground: bool = True,
    forward_only: bool = False,
    max_range: float = 100.0,
    min_range: float = 1.5,
    z_clip: tuple[float, float] = (-4.0, 20.0),
) -> tuple[np.ndarray, np.ndarray | None]:
    """
    Load one curated KITTI frame as (N, 3) xyz plus optional SemanticKITTI labels.

    The Velodyne sits ~1.73 m above the road, so raw ground is near Z ≈ −1.7 m.
    `normalize_ground` shifts the cloud so the road surface is ≈ 0, using labeled
    road points when the .label file is present.

    Range and Z clips are a cheap noise/ego filter (not a learned denoiser).
    """
    pts = load_kitti_bin(DATASET_DIR / "raw" / f"{frame_id}.bin")
    labels = load_semantic_labels(frame_id)
    if labels is not None and len(labels) != len(pts):
        labels = None

    radial = np.hypot(pts[:, 0], pts[:, 1])
    z_lo, z_hi = z_clip
    keep = (radial >= min_range) & (radial <= max_range)
    keep &= (pts[:, 2] >= z_lo) & (pts[:, 2] <= z_hi)
    if forward_only:
        keep &= pts[:, 0] > 0.0
    pts = pts[keep]
    if labels is not None:
        labels = labels[keep]

    if normalize_ground:
        ground_z = _estimate_ground_z(pts, labels)
        pts = pts.copy()
        pts[:, 2] -= ground_z

    return np.ascontiguousarray(pts, dtype=np.float32), labels


def _compact_frame(entry: dict) -> dict:
    metrics = entry.get("metrics") or {}
    return {
        "id":           entry.get("foveadrive_frame_id"),
        "sequence":     entry.get("source_sequence"),
        "source_frame": entry.get("source_frame"),
        "category":     entry.get("selection_category") or "untagged",
        "population":   entry.get("population") or "untagged",
        "difficulty":   round(float(metrics.get("difficulty", 0.0)), 3),
        "special":      bool(entry.get("is_special")),
    }


def list_dataset_frames() -> list[dict]:
    """Compact catalog of frames that actually exist under data/lidar/raw/."""
    global _CATALOG, _COMPACT_FRAMES
    if _COMPACT_FRAMES is not None:
        return _COMPACT_FRAMES
    on_disk = set(list_frames())
    meta_path = DATASET_DIR / "metadata" / "frames.json"
    if meta_path.exists():
        if _CATALOG is None:
            with meta_path.open(encoding="utf-8") as f:
                _CATALOG = json.load(f)
        frames = []
        for entry in _CATALOG.get("frames", []):
            fid = entry.get("foveadrive_frame_id")
            if fid in on_disk:
                frames.append(_compact_frame(entry))
        if frames:
            _COMPACT_FRAMES = frames
            return _COMPACT_FRAMES
    _COMPACT_FRAMES = [
        {
            "id": fid,
            "sequence": None,
            "source_frame": None,
            "category": "kitti",
            "population": "on_disk",
            "difficulty": 0.0,
            "special": False,
        }
        for fid in sorted(on_disk)
    ]
    return _COMPACT_FRAMES


def dataset_header() -> dict:
    if _CATALOG is None and (DATASET_DIR / "metadata" / "frames.json").exists():
        list_dataset_frames()
    if _CATALOG:
        return {
            "name":    _CATALOG.get("dataset", "FoveaDrive LiDAR Dataset"),
            "version": _CATALOG.get("version", "v1"),
        }
    return {"name": "FoveaDrive LiDAR Dataset", "version": "local"}
