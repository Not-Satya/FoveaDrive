# backend/data/loader.py

import numpy as np
from pathlib import Path


# ---------------------------------------------------------------------------
# Synthetic data generator  (primary — no hardware needed)
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

    # --- Ground (flat, low-Z noise) ---
    n_ground = int(num_points * 0.62)
    ground_xy = rng.uniform(-25, 25, (n_ground, 2))
    ground_z  = rng.uniform(0.0, 0.12, (n_ground, 1))

    # --- Potholes: depress existing ground points so cell means go negative ---
    pothole_specs = [
        # (centre_x, centre_y, radius_m, z_lo, z_hi)
        (  7.5, -2.5, 1.4, -0.58, -0.32),  # near — too deep for sedan
        (  3.0,  5.0, 0.9, -0.22, -0.10),  # near — shallow, sedan-ok
        ( 16.0,  3.5, 1.6, -0.72, -0.40),  # mid — deep
        ( 11.0, -7.0, 1.1, -0.38, -0.18),  # mid — medium
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

    # --- Obstacles (tall clusters, various distances) ---
    obstacle_specs = [
        # (centre_x, centre_y, spread, z_min, z_max, n_points)
        (  5.0,  2.0,  0.8, 0.6, 1.8, 120),   # near zone – sedan blocker
        ( -4.0,  3.5,  0.6, 0.5, 1.2, 100),   # near zone – sedan+suv blocker
        ( 18.0, -5.0,  1.5, 0.8, 2.5, 200),   # mid zone – generic wall
        ( 25.0,  8.0,  2.0, 1.0, 3.5, 220),   # mid zone – large obstacle
        ( 40.0,  0.0,  3.0, 0.6, 4.0, 250),   # far zone – big structure
        (-20.0, 12.0,  2.5, 0.5, 2.0, 180),   # far zone
    ]

    obstacle_parts = []
    for (cx, cy, spread, zlo, zhi, n) in obstacle_specs:
        ox = rng.normal(cx, spread, (n, 1))
        oy = rng.normal(cy, spread, (n, 1))
        oz = rng.uniform(zlo, zhi, (n, 1))
        obstacle_parts.append(np.hstack([ox, oy, oz]))
    obstacles = np.vstack(obstacle_parts)

    # --- Rough patches (moderate Z variance, drivable for truck/suv only) ---
    n_rough = num_points - n_ground - len(obstacles)
    rough_xy = rng.uniform(-20, 20, (n_rough, 2))
    # only generate rough patches in the mid-distance ring
    dist = np.linalg.norm(rough_xy, axis=1)
    mask = (dist > 10) & (dist < 30)
    rough_xy = rough_xy[mask][:n_rough]
    rough_z  = rng.uniform(0.2, 0.45, (len(rough_xy), 1))
    rough    = np.hstack([rough_xy, rough_z])

    cloud = np.vstack([ground, potholes, obstacles, rough]).astype(np.float32)
    return cloud


# ---------------------------------------------------------------------------
# Optional: KITTI binary loader  (.bin files from KITTI/nuScenes)
# ---------------------------------------------------------------------------

def load_kitti_bin(filepath: str | Path) -> np.ndarray:
    """
    Load a KITTI-format .bin point cloud file.
    Each point is stored as (x, y, z, intensity) float32.
    Returns an (N, 3) array (intensity column dropped).
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Point cloud file not found: {path}")

    raw = np.fromfile(str(path), dtype=np.float32).reshape(-1, 4)
    return raw[:, :3]   # drop intensity, keep x y z
