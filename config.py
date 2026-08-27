# backend/config.py

# ---------------------------------------------------------------------------
# Data source
# ---------------------------------------------------------------------------
# "kitti"     → load a real curated frame from data/lidar/raw/<frame_id>.bin
# "synthetic" → generate a synthetic point cloud (no dataset needed)
#
# The HUD / GET /map?frame=frame_XXXXXX switches this at runtime.
DATA_CONFIG = {
    "source":           "kitti",          # "kitti" | "synthetic"
    "frame_id":         "frame_000000",   # which curated frame to load
    "normalize_ground": True,             # shift road surface to Z≈0 (required for KITTI)
    "forward_only":     False,            # keep only points ahead of the vehicle (x > 0)
    "min_range":        2.0,              # drop near-sensor returns (m); ego body uses the box below
    "z_clip":           (-4.0, 20.0),     # drop flyers in sensor frame before ground shift
    # KITTI Velodyne is on the roof. Hood / mirror / A-pillar hits sit 1.5–3 m out
    # at Z ≈ 0.9–1.3 m after ground normalize and look like obstacles in the blind spot.
    "ego_x":            (-2.4, 3.2),      # vehicle body along X (rear, front) in metres
    "ego_half_width":   1.5,              # |Y| of body + mirrors (m)
    "ego_z_min":        0.40,             # drop body returns above the road (m)
    # surround = full 360° cloud (current 3/4 map). windshield = driver FOV wedge.
    "scan_mode":            "surround",   # "surround" | "windshield"
    "windshield_fov_deg":   120.0,        # horizontal FOV kept in windshield mode
    "look_dir":             "front",      # "front" | "rear" (rear only used in windshield)
}

GRID_CONFIG = {
    "near": {"max_dist": 10.0, "cell_size": 0.25},
    "mid":  {"max_dist": 30.0, "cell_size": 0.5},
    "far":  {"max_dist": 100.0, "cell_size": 1.0},
}

# Thresholds calibrated for ground-normalized KITTI scans (road surface ≈ 0).
# Real LiDAR is noisier than the synthetic cloud, so these are looser than the
# original synthetic-tuned values (was -0.08 / 0.15 / 0.5).
TERRAIN_CONFIG = {
    # Height / roughness / depression are measured relative to a fitted road plane
    # so a 1% grade over 20 m is not treated as a sedan-clearance failure.
    "height_threshold": 0.4,   # metres above local ground
    "roughness_threshold": 0.22,
    "depression_threshold": -0.25,
    "max_grade": 0.12,         # clamp fitted plane slope (rise/run)
    # Sparse near-field unlabeled hits (1–3 points) are ego/sensor flyers, not obstacles.
    "min_obstacle_points": 4,
    "flyer_range": 5.0,
    # False → drivability is height/roughness only. SemanticKITTI stays an overlay.
    "use_semantics": False,
}
