# backend/main.py

from data.loader import load_sample_points
from processing.grid import AdaptiveGrid
from processing.terrain import classify_terrain
from processing.drivability import evaluate_drivability
from models.vehicle import get_vehicle

# ---------------------------------------------------------------------------
# Shared point cloud + grid (computed once, reused by all pipelines)
# ---------------------------------------------------------------------------
_POINTS = None
_BASE_GRID: list[dict] | None = None


def _get_base_grid() -> list[dict]:
    """
    Load points and build the classified grid once.
    Terrain classification is vehicle-independent, so we cache it.
    """
    global _POINTS, _BASE_GRID
    if _BASE_GRID is None:
        _POINTS = load_sample_points()
        grid = AdaptiveGrid()
        grid.add_points(_POINTS)
        _BASE_GRID = classify_terrain(grid.export())
    # Return a fresh copy so drivability annotations don't pollute the cache
    import copy
    return copy.deepcopy(_BASE_GRID)


def invalidate_base_grid() -> None:
    global _POINTS, _BASE_GRID
    _POINTS = None
    _BASE_GRID = None


def run_pipeline(vehicle_type: str = "sedan") -> list[dict]:
    """
    Full pipeline using a predefined vehicle profile (sedan / suv / truck).
    Returns enriched list of cell dicts.
    """
    map_data = _get_base_grid()
    vehicle  = get_vehicle(vehicle_type)
    return evaluate_drivability(map_data, vehicle)


def run_custom_pipeline(
    ground_clearance: float,
    width: float,
    wheel_radius: float,
    max_roughness: float | None = None,
) -> list[dict]:
    """
    Full pipeline using arbitrary vehicle parameters (from UI sliders).
    max_roughness defaults to ground_clearance * 0.6 if not supplied.
    """
    if max_roughness is None:
        max_roughness = round(ground_clearance * 0.6, 3)

    vehicle = {
        "ground_clearance": ground_clearance,
        "width":            width,
        "wheel_radius":     wheel_radius,
        "max_roughness":    max_roughness,
    }
    map_data = _get_base_grid()
    return evaluate_drivability(map_data, vehicle)


def build_stats(cells: list[dict], vehicle_label: str = "custom") -> dict:
    """Compute summary statistics from an already-processed cell list."""
    total        = len(cells)
    drivable     = sum(1 for c in cells if c["drivable"])
    non_drivable = total - drivable

    zone_counts    = {}
    terrain_counts = {}
    reason_counts  = {}

    for cell in cells:
        z = cell["zone"]
        zone_counts.setdefault(z, {"total": 0, "drivable": 0})
        zone_counts[z]["total"] += 1
        if cell["drivable"]:
            zone_counts[z]["drivable"] += 1

        t = cell["terrain"]
        terrain_counts[t] = terrain_counts.get(t, 0) + 1

        r = cell.get("reason", "unknown")
        reason_counts[r] = reason_counts.get(r, 0) + 1

    return {
        "vehicle":           vehicle_label,
        "total_cells":       total,
        "drivable":          drivable,
        "non_drivable":      non_drivable,
        "drivable_pct":      round(drivable / total * 100, 1) if total else 0,
        "zone_breakdown":    zone_counts,
        "terrain_breakdown": terrain_counts,
        "reason_breakdown":  reason_counts,
    }


if __name__ == "__main__":
    import json
    result   = run_pipeline("sedan")
    drivable = sum(1 for c in result if c["drivable"])
    total    = len(result)
    print(f"Total cells : {total}")
    print(f"Drivable    : {drivable} ({drivable/total*100:.1f}%)")
    print(f"Non-drivable: {total - drivable}")
    print("\nSample cell:")
    print(json.dumps(result[0], indent=2))
