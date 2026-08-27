# backend/processing/grid.py

from typing import Dict, List

import numpy as np

from config import GRID_CONFIG
from data.semantics import OBSTACLE_CLASSES, semantic_name


ZONE_NAMES = ("near", "mid", "far")


def _zone_and_size_arrays(dist: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    near_max = GRID_CONFIG["near"]["max_dist"]
    mid_max = GRID_CONFIG["mid"]["max_dist"]
    zone_id = np.where(dist < near_max, 0, np.where(dist < mid_max, 1, 2)).astype(np.int32)
    sizes = np.array([
        GRID_CONFIG["near"]["cell_size"],
        GRID_CONFIG["mid"]["cell_size"],
        GRID_CONFIG["far"]["cell_size"],
    ], dtype=np.float64)
    return zone_id, sizes[zone_id]


class AdaptiveGrid:
    """
    Bins a point cloud into a variable-resolution 2.5D grid.

    Each bin key is (grid_x_index, grid_y_index, zone) so that
    near/mid/far cells never accidentally share the same bucket.
    """

    def __init__(self) -> None:
        self._cells: List[Dict] = []
        self._cell_sizes: Dict[str, float] = {
            zone: cfg["cell_size"] for zone, cfg in GRID_CONFIG.items()
        }

    def add_points(self, points: np.ndarray, labels: np.ndarray | None = None) -> None:
        """
        Ingest an (N, 3) float array of (x, y, z) points, optionally with
        per-point SemanticKITTI class ids of shape (N,).
        Points beyond the far zone's max_dist are ignored.
        """
        if points.size == 0:
            return

        far_max = GRID_CONFIG["far"]["max_dist"]
        x = points[:, 0].astype(np.float64, copy=False)
        y = points[:, 1].astype(np.float64, copy=False)
        z = points[:, 2].astype(np.float64, copy=False)
        dist = np.hypot(x, y)
        keep = dist <= far_max
        x, y, z, dist = x[keep], y[keep], z[keep], dist[keep]
        if x.size == 0:
            return

        sem = None
        if labels is not None:
            sem = np.asarray(labels, dtype=np.int32)[keep]

        zone_id, cell_size = _zone_and_size_arrays(dist)
        ix = np.floor(x / cell_size).astype(np.int32)
        iy = np.floor(y / cell_size).astype(np.int32)

        keys = np.stack([ix, iy, zone_id], axis=1)
        uniq, inv = np.unique(keys, axis=0, return_inverse=True)
        counts = np.bincount(inv)
        sum_z = np.bincount(inv, weights=z)
        sum_z2 = np.bincount(inv, weights=z * z)
        mean = sum_z / counts
        var = np.maximum(sum_z2 / counts - mean * mean, 0.0)
        std = np.sqrt(var)

        maj = None
        obs_frac = None
        if sem is not None:
            pair = inv.astype(np.int64) * 1000 + (sem.astype(np.int64) % 1000)
            pu, pcount = np.unique(pair, return_counts=True)
            g = (pu // 1000).astype(np.int32)
            s = (pu % 1000).astype(np.int32)
            maj = np.zeros(len(uniq), dtype=np.int32)
            best = np.zeros(len(uniq), dtype=np.int32)
            obs_n = np.zeros(len(uniq), dtype=np.int32)
            for gi, si, ci in zip(g.tolist(), s.tolist(), pcount.tolist()):
                if si in OBSTACLE_CLASSES:
                    obs_n[gi] += ci
                if ci > best[gi]:
                    best[gi] = ci
                    maj[gi] = si
            obs_frac = obs_n / np.maximum(counts, 1)

        rows: List[Dict] = []
        for i, (ixi, iyi, zid) in enumerate(uniq):
            zone = ZONE_NAMES[int(zid)]
            cs = self._cell_sizes[zone]
            cell: Dict = {
                "x":           round(int(ixi) * cs + cs / 2, 3),
                "y":           round(int(iyi) * cs + cs / 2, 3),
                "zone":        zone,
                "cell_size":   cs,
                "height":      round(float(mean[i]), 4),
                "height_std":  round(float(std[i]), 4),
                "point_count": int(counts[i]),
            }
            if maj is not None:
                cid = int(maj[i])
                cell["semantic"] = cid
                cell["semantic_name"] = semantic_name(cid)
                cell["obstacle_frac"] = round(float(obs_frac[i]), 3)
            rows.append(cell)
        self._cells.extend(rows)

    def export(self) -> List[Dict]:
        return list(self._cells)
