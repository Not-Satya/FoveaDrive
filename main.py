# backend/main.py

from config import DATA_CONFIG, GRID_CONFIG
from data.loader import (
    clip_azimuth_fov,
    dataset_header,
    list_dataset_frames,
    load_frame,
    load_sample_points,
    raw_point_count,
)
from processing.grid import AdaptiveGrid
from processing.terrain import classify_terrain
from processing.drivability import evaluate_drivability
from models.vehicle import get_vehicle


SCAN_MODES = ("surround", "windshield")
LOOK_DIRS = ("front", "rear")


def _normalize_scan_mode(mode: str) -> str:
    key = (mode or "").strip().lower()
    aliases = {
        "surround": "surround",
        "360": "surround",
        "full": "surround",
        "iso": "surround",
        "windshield": "windshield",
        "fov": "windshield",
        "front": "windshield",
        "120": "windshield",
        "rear": "windshield",
        "back": "windshield",
    }
    if key not in aliases:
        raise ValueError(f"Unknown scan mode '{mode}' (use surround or windshield)")
    return aliases[key]


def _normalize_look_dir(look: str) -> str:
    key = (look or "").strip().lower()
    aliases = {
        "front": "front",
        "forward": "front",
        "windshield": "front",
        "rear": "rear",
        "back": "rear",
        "behind": "rear",
        "reverse": "rear",
    }
    if key not in aliases:
        raise ValueError(f"Unknown look direction '{look}' (use front or rear)")
    return aliases[key]


def _grid_key() -> str:
    mode = DATA_CONFIG.get("scan_mode", "surround")
    if mode != "windshield":
        return "surround"
    look = DATA_CONFIG.get("look_dir", "front")
    return f"windshield-{look}"


def _load_points():
    """
    Load the active point cloud based on DATA_CONFIG:
      - "kitti"     → a real curated frame from data/lidar/raw/
      - "synthetic" → the built-in synthetic generator (no dataset needed)
    Returns the full (range-clipped, ground-normalized) cloud. Scan-mode FOV
    is applied later so surround/windshield can share one disk read.
    """
    if DATA_CONFIG["source"] == "synthetic":
        return load_sample_points(), None
    return load_frame(
        frame_id=DATA_CONFIG["frame_id"],
        normalize_ground=DATA_CONFIG["normalize_ground"],
        forward_only=DATA_CONFIG["forward_only"],
        max_range=GRID_CONFIG["far"]["max_dist"],
        min_range=DATA_CONFIG.get("min_range", 1.5),
        z_clip=DATA_CONFIG.get("z_clip", (-4.0, 20.0)),
    )


# ---------------------------------------------------------------------------
# Shared point cloud + per-scan grid (vehicle-independent terrain cache)
# ---------------------------------------------------------------------------
_POINTS = None
_LABELS = None
_BASE_GRIDS: dict[str, list[dict]] = {}


def _points_for_scan(key: str) -> tuple:
    global _POINTS, _LABELS
    if _POINTS is None:
        _POINTS, _LABELS = _load_points()
    if not key.startswith("windshield"):
        return _POINTS, _LABELS
    fov = float(DATA_CONFIG.get("windshield_fov_deg", 120.0))
    heading = "rear" if key.endswith("rear") else "front"
    return clip_azimuth_fov(_POINTS, _LABELS, fov, heading=heading)


def _get_base_grid() -> list[dict]:
    """
    Load points and build the classified grid once per scan mode / look dir.
    Terrain classification is vehicle-independent, so we cache it.
    """
    import copy
    key = _grid_key()
    if key not in _BASE_GRIDS:
        pts, labels = _points_for_scan(key)
        grid = AdaptiveGrid()
        grid.add_points(pts, labels)
        _BASE_GRIDS[key] = classify_terrain(grid.export())
    return copy.deepcopy(_BASE_GRIDS[key])


def invalidate_base_grid() -> None:
    global _POINTS, _LABELS, _BASE_GRIDS
    _POINTS = None
    _LABELS = None
    _BASE_GRIDS = {}


def set_scan_mode(mode: str) -> bool:
    """Switch surround (360°) vs windshield (120° FOV). Returns True if it changed."""
    normalized = _normalize_scan_mode(mode)
    changed = DATA_CONFIG.get("scan_mode", "surround") != normalized
    DATA_CONFIG["scan_mode"] = normalized
    if normalized != "windshield":
        if DATA_CONFIG.get("look_dir") != "front":
            DATA_CONFIG["look_dir"] = "front"
            changed = True
    return changed


def set_look_dir(look: str) -> bool:
    """Front vs rear wedge. Rear is ignored unless scan_mode is windshield."""
    normalized = _normalize_look_dir(look)
    if DATA_CONFIG.get("scan_mode", "surround") != "windshield":
        if DATA_CONFIG.get("look_dir", "front") == "front":
            return False
        DATA_CONFIG["look_dir"] = "front"
        return True
    if DATA_CONFIG.get("look_dir", "front") == normalized:
        return False
    DATA_CONFIG["look_dir"] = normalized
    return True


def set_active_frame(frame_id: str) -> bool:
    """
    Switch the active cloud. Returns True if the cache was invalidated.
    Pass 'synthetic' to use the generator instead of KITTI.
    """
    frame_id = (frame_id or "").strip()
    if frame_id == "synthetic":
        if DATA_CONFIG["source"] == "synthetic":
            return False
        DATA_CONFIG["source"] = "synthetic"
        invalidate_base_grid()
        return True

    available = {f["id"] for f in list_dataset_frames()}
    if frame_id not in available:
        raise ValueError(f"Unknown frame '{frame_id}'")
    if DATA_CONFIG["source"] == "kitti" and DATA_CONFIG["frame_id"] == frame_id:
        return False
    DATA_CONFIG["source"] = "kitti"
    DATA_CONFIG["frame_id"] = frame_id
    invalidate_base_grid()
    return True


def get_dataset_info() -> dict:
    header = dataset_header()
    frames = list_dataset_frames()
    source = DATA_CONFIG["source"]
    frame_id = None if source == "synthetic" else DATA_CONFIG["frame_id"]
    current_meta = next((f for f in frames if f["id"] == frame_id), None)
    current = {
        "source": source,
        "frame_id": frame_id,
        "point_count": None if source == "synthetic" else raw_point_count(frame_id or ""),
        "labeled": source == "kitti",
        "scan_mode": DATA_CONFIG.get("scan_mode", "surround"),
        "look_dir": (
            DATA_CONFIG.get("look_dir", "front")
            if DATA_CONFIG.get("scan_mode") == "windshield"
            else "front"
        ),
        "fov_deg": (
            float(DATA_CONFIG.get("windshield_fov_deg", 120.0))
            if DATA_CONFIG.get("scan_mode") == "windshield"
            else 360.0
        ),
    }
    if current_meta:
        current.update(current_meta)
    return {
        **header,
        "current": current,
        "frames": [
            {"id": "synthetic", "sequence": None, "source_frame": None,
             "category": "generated", "population": "synthetic",
             "difficulty": 0.0, "special": False},
            *frames,
        ],
    }


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
    semantic_counts = {}

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

        name = cell.get("semantic_name")
        if name:
            semantic_counts[name] = semantic_counts.get(name, 0) + 1

    scan_mode = DATA_CONFIG.get("scan_mode", "surround")
    look_dir = DATA_CONFIG.get("look_dir", "front") if scan_mode == "windshield" else "front"
    return {
        "vehicle":            vehicle_label,
        "scan_mode":          scan_mode,
        "look_dir":           look_dir,
        "fov_deg": (
            float(DATA_CONFIG.get("windshield_fov_deg", 120.0))
            if scan_mode == "windshield"
            else 360.0
        ),
        "total_cells":        total,
        "drivable":           drivable,
        "non_drivable":       non_drivable,
        "drivable_pct":       round(drivable / total * 100, 1) if total else 0,
        "zone_breakdown":     zone_counts,
        "terrain_breakdown":  terrain_counts,
        "reason_breakdown":   reason_counts,
        "semantic_breakdown": semantic_counts,
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
