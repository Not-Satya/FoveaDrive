# backend/processing/drivability.py

from typing import List, Dict


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_obstacle_index(grid_data: List[Dict]) -> set:
    """
    Build a set of (x, y) tuples for cells that are obstacles,
    snapped to their own cell_size grid — used for fast lookup.
    """
    return {
        (cell["x"], cell["y"])
        for cell in grid_data
        if cell["terrain"] == "obstacle"
    }


def _has_obstacle_in_footprint(
    cx: float,
    cy: float,
    half_width: float,
    grid_data: List[Dict],
) -> bool:
    """
    Return True if any obstacle cell's centre falls within `half_width`
    metres laterally of point (cx, cy).

    We check all cells whose centre is within a circle of radius half_width,
    which is a safe, direction-agnostic approximation of the vehicle footprint.
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


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def evaluate_drivability(grid_data: List[Dict], vehicle: Dict) -> List[Dict]:
    """
    Annotate each cell with drivability information based on vehicle params.

    Per-cell decision logic:
      1. terrain == "obstacle"
            → non_drivable  (cell itself is an obstacle)

      2. Any obstacle cell within vehicle_width/2 radius
            → non_drivable  (vehicle footprint would clip the obstacle)

      3. terrain == "rough"
            height_std > vehicle["max_roughness"]
            → non_drivable  (too rough for this vehicle)
            else → drivable

      4. terrain == "ground"
            height > vehicle["ground_clearance"]
            → non_drivable  (unexpected raised ground / step)
            else → drivable

    Added fields per cell:
      "drivable"  : bool
      "reason"    : str  (human-readable, useful for debugging/UI tooltip)
      "color"     : str  "#00c853" green | "#d50000" red
    """
    clearance   = vehicle["ground_clearance"]
    max_rough   = vehicle["max_roughness"]
    half_width  = vehicle["width"] / 2.0

    for cell in grid_data:
        terrain = cell["terrain"]
        h       = cell["height"]
        std     = cell["height_std"]

        # Rule 1 — cell is itself an obstacle
        if terrain == "obstacle":
            cell["drivable"] = False
            cell["reason"]   = "obstacle"
            cell["color"]    = "#d50000"
            continue

        # Rule 2 — obstacle within vehicle footprint
        if _has_obstacle_in_footprint(cell["x"], cell["y"], half_width, grid_data):
            cell["drivable"] = False
            cell["reason"]   = "obstacle_nearby"
            cell["color"]    = "#ff6d00"   # orange — footprint collision
            continue

        # Rule 3 — rough terrain
        if terrain == "rough":
            if std > max_rough:
                cell["drivable"] = False
                cell["reason"]   = "too_rough"
                cell["color"]    = "#d50000"
            else:
                cell["drivable"] = True
                cell["reason"]   = "rough_ok"
                cell["color"]    = "#ffd600"   # yellow — passable but rough
            continue

        # Rule 4 — ground with unexpected step
        if h > clearance:
            cell["drivable"] = False
            cell["reason"]   = "height_exceeds_clearance"
            cell["color"]    = "#d50000"
        else:
            cell["drivable"] = True
            cell["reason"]   = "clear"
            cell["color"]    = "#00c853"

    return grid_data
