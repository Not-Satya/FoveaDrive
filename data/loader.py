# backend/data/loader.py

import numpy as np


def load_sample_points(num_points: int = 5000) -> np.ndarray:

    # Ground
    ground = np.random.rand(num_points, 3)
    ground[:, 0:2] *= 50
    ground[:, 2] *= 0.3   # very flat ground

    # STRONG obstacles
    obstacle = np.random.rand(int(num_points * 0.3), 3)
    obstacle[:, 0:2] = obstacle[:, 0:2] * 8 + 20  # tight cluster
    obstacle[:, 2] = obstacle[:, 2] * 8 + 2       # height: 2 → 7

    return np.vstack((ground, obstacle))