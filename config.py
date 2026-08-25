# backend/config.py

GRID_CONFIG = {
    "near": {"max_dist": 10.0, "cell_size": 0.5},
    "mid": {"max_dist": 30.0, "cell_size": 1.0},
    "far": {"max_dist": 100.0, "cell_size": 2.0},
}

TERRAIN_CONFIG = {
    "height_threshold": 0.5
}