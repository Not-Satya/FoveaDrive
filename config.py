# backend/config.py

# ---------------------------------------------------------------------------
# Data source
# ---------------------------------------------------------------------------
# "kitti"     → load a real curated frame from data/lidar/raw/<frame_id>.bin
# "synthetic" → generate a synthetic point cloud (no dataset needed)
#
# To scrub through the 1,200 curated frames, change "frame_id" (e.g.
# "frame_000042") and clear the cache (POST /cache/clear) or restart the server.
DATA_CONFIG = {
    "source":           "kitti",          # "kitti" | "synthetic"
    "frame_id":         "frame_000000",   # which curated frame to load
    "normalize_ground": True,             # shift road surface to Z≈0 (required for KITTI)
    "forward_only":     False,            # keep only points ahead of the vehicle (x > 0)
}

GRID_CONFIG = {
    "near": {"max_dist": 10.0, "cell_size": 0.5},
    "mid":  {"max_dist": 30.0, "cell_size": 1.0},
    "far":  {"max_dist": 100.0, "cell_size": 2.0},
}

# Thresholds calibrated for ground-normalized KITTI scans (road surface ≈ 0).
# Real LiDAR is noisier than the synthetic cloud, so these are looser than the
# original synthetic-tuned values (was -0.08 / 0.15 / 0.5).
TERRAIN_CONFIG = {
    # A cell whose mean Z exceeds this is classified as an obstacle
    "height_threshold": 0.4,   # metres
    # A cell with height std above this is "rough" (slope-like)
    "roughness_threshold": 0.22,
    # Mean Z below this (negative) is a depression / pothole
    "depression_threshold": -0.25,
}
