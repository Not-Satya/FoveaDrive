# backend/processing/drivability.py

from typing import List, Dict


def _has_obstacle_in_footprint(
    cx: float,
    cy: float,
    half_width: float,
    grid_data: List[Dict],
) -> bool:
    """
    Return True if any obstacle cell's centre falls within `half_width`
    metres of point (cx, cy).
    """
    hw2 = half_width ** 2
    for cell in grid_data:
        if cell["terrain"] != "obstacle":
            continue
        dx = cell["x"] - cx
        dy = cell["y"] - cy
        if dx * dx + dy * dy <= hw2:
            return True
    return False


def evaluate_drivability(grid_data: List[Dict], vehicle: Dict) -> List[Dict]:
    """
    Annotate each cell with drivability based on vehicle params.

    Per-cell decision logic:
      1. terrain == "obstacle"
            → non_drivable

      2. terrain == "depression"  (below-grade pothole)
            depth > wheel_radius * 0.5
            → non_drivable  (wheel drops in)
            else → drivable (shallow dip)

      3. Any obstacle within vehicle_width/2
            → non_drivable

      4. terrain == "rough"
            height_std > max_roughness → non_drivable else drivable

      5. terrain == "ground"
            height > ground_clearance → non_drivable else drivable
    """
    clearance   = vehicle["ground_clearance"]
    max_rough   = vehicle["max_roughness"]
    half_width  = vehicle["width"] / 2.0
    wheel_r     = vehicle.get("wheel_radius", 0.32)
    max_pothole = wheel_r * 0.5

    for cell in grid_data:
        terrain = cell["terrain"]
        h       = cell["height"]
        std     = cell["height_std"]

        # Rule 1 — cell is itself an obstacle (above grade)
        if terrain == "obstacle":
            cell["drivable"] = False
            cell["reason"]   = "obstacle"
            cell["color"]    = "#ff4ad6"
            continue

        # Rule 2 — pothole / below-grade depression (wheel radius)
        if terrain == "depression" or h < 0:
            depth = -h
            if depth > max_pothole:
                cell["drivable"] = False
                cell["reason"]   = "pothole"
                cell["color"]    = "#22b8ff"
            else:
                cell["drivable"] = True
                cell["reason"]   = "pothole_ok"
                cell["color"]    = "#3d7ad6"
            continue

        # Rule 3 — obstacle within vehicle footprint
        if _has_obstacle_in_footprint(cell["x"], cell["y"], half_width, grid_data):
            cell["drivable"] = False
            cell["reason"]   = "obstacle_nearby"
            cell["color"]    = "#bce3ff"
            continue

        # Rule 4 — rough terrain
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

        # Rule 5 — ground with unexpected step
        if h > clearance:
            cell["drivable"] = False
            cell["reason"]   = "height_exceeds_clearance"
            cell["color"]    = "#ff4ad6"
        else:
            cell["drivable"] = True
            cell["reason"]   = "clear"
            cell["color"]    = "#1a3a8c"

    return grid_data
