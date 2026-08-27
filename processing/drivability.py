# backend/processing/drivability.py

from typing import List, Dict

import numpy as np


def evaluate_drivability(grid_data: List[Dict], vehicle: Dict) -> List[Dict]:
    """
    Annotate each cell with drivability based on vehicle params.

    Per-cell decision logic:
      1. terrain == "obstacle" → non_drivable
      2. terrain == "depression"
            depth > wheel_radius * 0.5 → pothole, else pothole_ok
      3. Any obstacle within vehicle_width/2 → obstacle_nearby
      4. terrain == "rough" → too_rough or rough_ok
      5. ground step vs ground_clearance
    """
    clearance   = vehicle["ground_clearance"]
    max_rough   = vehicle["max_roughness"]
    half_width  = vehicle["width"] / 2.0
    wheel_r     = vehicle.get("wheel_radius", 0.32)
    max_pothole = wheel_r * 0.5
    hw2 = half_width ** 2

    obs = np.array(
        [[c["x"], c["y"]] for c in grid_data if c["terrain"] == "obstacle"],
        dtype=np.float64,
    )

    def obstacle_in_footprint(cx: float, cy: float) -> bool:
        if obs.size == 0:
            return False
        d2 = (obs[:, 0] - cx) ** 2 + (obs[:, 1] - cy) ** 2
        return bool(np.any(d2 <= hw2))

    for cell in grid_data:
        terrain = cell["terrain"]
        h       = cell["height"]
        std     = cell["height_std"]

        if terrain == "obstacle":
            cell["drivable"] = False
            cell["reason"]   = "obstacle"
            cell["color"]    = "#ff4ad6"
            continue

        if terrain == "depression":
            depth = max(-h, 0.0)
            if depth > max_pothole:
                cell["drivable"] = False
                cell["reason"]   = "pothole"
                cell["color"]    = "#22b8ff"
            else:
                cell["drivable"] = True
                cell["reason"]   = "pothole_ok"
                cell["color"]    = "#3d7ad6"
            continue

        if obstacle_in_footprint(cell["x"], cell["y"]):
            cell["drivable"] = False
            cell["reason"]   = "obstacle_nearby"
            cell["color"]    = "#bce3ff"
            continue

        if terrain == "rough":
            if std > max_rough:
                cell["drivable"] = False
                cell["reason"]   = "too_rough"
                cell["color"]    = "#ff4ad6"
            else:
                cell["drivable"] = True
                cell["reason"]   = "rough_ok"
                cell["color"]    = "#3d5aaa"
            continue

        if h > clearance:
            cell["drivable"] = False
            cell["reason"]   = "height_exceeds_clearance"
            cell["color"]    = "#ff4ad6"
        else:
            cell["drivable"] = True
            cell["reason"]   = "clear"
            cell["color"]    = "#1a3a8c"

    return grid_data
