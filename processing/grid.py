# backend/processing/grid.py

from typing import Dict, List, Tuple
import numpy as np

from config import GRID_CONFIG
from utils.geometry import compute_distance


class AdaptiveGrid:
    def __init__(self) -> None:
        self.grid: Dict[Tuple[int, int], List[float]] = {}

    def _get_cell_size(self, distance: float) -> float:
        if distance < GRID_CONFIG["near"]["max_dist"]:
            return GRID_CONFIG["near"]["cell_size"]
        elif distance < GRID_CONFIG["mid"]["max_dist"]:
            return GRID_CONFIG["mid"]["cell_size"]
        else:
            return GRID_CONFIG["far"]["cell_size"]

    def add_points(self, points: np.ndarray) -> None:
        """
        Populate grid with point cloud data.
        """
        for x, y, z in points:
            d = compute_distance(x, y)
            cell_size = self._get_cell_size(d)

            gx = int(x // cell_size)
            gy = int(y // cell_size)

            key = (gx, gy)

            if key not in self.grid:
                self.grid[key] = []

            self.grid[key].append(z)

    def build_map(self) -> List[Dict]:
        """
        Convert grid to structured 2.5D representation.
        """
        result = []

        for (gx, gy), heights in self.grid.items():
            avg_height = float(np.max(heights))

            result.append({
                "x": gx,
                "y": gy,
                "height": avg_height
            })

        return result