# backend/processing/grid.py

from typing import Dict, List, Tuple
import numpy as np

from config import GRID_CONFIG
from utils.geometry import compute_distance


# ---------------------------------------------------------------------------
# Zone lookup
# ---------------------------------------------------------------------------

def _get_zone_and_cell_size(distance: float) -> Tuple[str, float]:
    """Return (zone_name, cell_size) for a given radial distance."""
    if distance < GRID_CONFIG["near"]["max_dist"]:
        return "near", GRID_CONFIG["near"]["cell_size"]
    elif distance < GRID_CONFIG["mid"]["max_dist"]:
        return "mid", GRID_CONFIG["mid"]["cell_size"]
    else:
        return "far", GRID_CONFIG["far"]["cell_size"]


# ---------------------------------------------------------------------------
# Adaptive Grid
# ---------------------------------------------------------------------------

class AdaptiveGrid:
    """
    Bins a point cloud into a variable-resolution 2.5D grid.

    Each bin key is (grid_x_index, grid_y_index, zone) so that
    near/mid/far cells never accidentally share the same bucket.
    Each bucket accumulates Z values for its column of points.
    """

    def __init__(self) -> None:
        # key: (ix, iy, zone)  →  value: list of Z values
        self._buckets: Dict[Tuple[int, int, str], List[float]] = {}
        # store cell_size per zone key (constant, but handy for export)
        self._cell_sizes: Dict[str, float] = {
            zone: cfg["cell_size"] for zone, cfg in GRID_CONFIG.items()
        }

    def add_points(self, points: np.ndarray) -> None:
        """
        Ingest an (N, 3) float array of (x, y, z) points.
        Points beyond the far zone's max_dist are silently ignored.
        """
        far_max = GRID_CONFIG["far"]["max_dist"]

        for x, y, z in points:
            dist = compute_distance(float(x), float(y))
            if dist > far_max:
                continue

            zone, cell_size = _get_zone_and_cell_size(dist)

            # Snap to grid cell index
            ix = int(np.floor(x / cell_size))
            iy = int(np.floor(y / cell_size))
            key = (ix, iy, zone)

            if key not in self._buckets:
                self._buckets[key] = []
            self._buckets[key].append(float(z))

    def export(self) -> List[Dict]:
        """
        Aggregate each bucket and return a list of cell dicts:

        {
            "x":           float,   # cell centre X (metres)
            "y":           float,   # cell centre Y (metres)
            "zone":        str,     # "near" | "mid" | "far"
            "cell_size":   float,   # metres
            "height":      float,   # mean Z of points in this cell
            "height_std":  float,   # std of Z  (roughness indicator)
            "point_count": int,
        }
        """
        result = []
        for (ix, iy, zone), z_values in self._buckets.items():
            cell_size = self._cell_sizes[zone]
            arr = np.array(z_values)
            result.append({
                "x":           round(ix * cell_size + cell_size / 2, 3),
                "y":           round(iy * cell_size + cell_size / 2, 3),
                "zone":        zone,
                "cell_size":   cell_size,
                "height":      round(float(arr.mean()), 4),
                "height_std":  round(float(arr.std()), 4),
                "point_count": len(z_values),
            })
        return result
