# backend/processing/terrain.py

from typing import List, Dict
from config import TERRAIN_CONFIG


def classify_terrain(grid_data: List[Dict]) -> List[Dict]:
    """
    Classify each grid cell as 'ground', 'obstacle', or 'rough'.

    Rules (applied in order):
      1. height > height_threshold      →  obstacle
      2. height_std > roughness_threshold →  rough (drivable for some vehicles)
      3. Otherwise                       →  ground
    """
    h_thresh = TERRAIN_CONFIG["height_threshold"]
    r_thresh = TERRAIN_CONFIG["roughness_threshold"]

    for cell in grid_data:
        h   = cell["height"]
        std = cell["height_std"]

        if h > h_thresh:
            cell["terrain"] = "obstacle"
        elif std > r_thresh:
            cell["terrain"] = "rough"
        else:
            cell["terrain"] = "ground"

    return grid_data
