# backend/utils/geometry.py

import numpy as np


def compute_distance(x: float, y: float) -> float:
    """Euclidean distance from the vehicle (origin) to a point (x, y)."""
    return float(np.sqrt(x ** 2 + y ** 2))


def points_in_radius(cells: list[dict], cx: float, cy: float, radius: float) -> list[dict]:
    """Return all cells whose centre is within `radius` metres of (cx, cy)."""
    result = []
    r2 = radius ** 2
    for cell in cells:
        dx = cell["x"] - cx
        dy = cell["y"] - cy
        if dx * dx + dy * dy <= r2:
            result.append(cell)
    return result
