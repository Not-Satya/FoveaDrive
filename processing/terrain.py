# backend/processing/terrain.py

from typing import List, Dict
from config import TERRAIN_CONFIG


def classify_terrain(grid_data: List[Dict]) -> List[Dict]:
    """
    Classify each grid cell as ground or obstacle.
    """
    threshold = TERRAIN_CONFIG["height_threshold"]

    for cell in grid_data:
        if cell["height"] < threshold:
            cell["terrain"] = "ground"
        else:
            cell["terrain"] = "obstacle"

    return grid_data