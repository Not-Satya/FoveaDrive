# backend/config.py

GRID_CONFIG = {
    "near": {"max_dist": 10.0, "cell_size": 0.5},
    "mid":  {"max_dist": 30.0, "cell_size": 1.0},
    "far":  {"max_dist": 100.0, "cell_size": 2.0},
}

TERRAIN_CONFIG = {
    # A cell whose mean Z exceeds this is classified as an obstacle
    "height_threshold": 0.5,   # metres
    # A cell with height std above this is "rough" (slope-like)
    "roughness_threshold": 0.15,
    # Mean Z below this (negative) is a depression / pothole
    "depression_threshold": -0.08,
}
