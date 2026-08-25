# backend/utils/geometry.py

import numpy as np

def compute_distance(x: float, y: float) -> float:
    return np.sqrt(x**2 + y**2)