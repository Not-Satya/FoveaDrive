# backend/models/vehicle.py

from typing import Dict


# ---------------------------------------------------------------------------
# Predefined vehicle profiles
# ---------------------------------------------------------------------------
# ground_clearance : max obstacle height (m) the vehicle can drive over
# wheel_radius     : used for slope/step tolerance (m)
# width            : total vehicle width — used for footprint drivability (m)
# max_roughness    : max height_std the vehicle can tolerate on rough ground
# ---------------------------------------------------------------------------

VEHICLE_PROFILES: Dict[str, Dict] = {
    "sedan": {
        "ground_clearance": 0.15,   # m
        "wheel_radius":     0.32,   # m
        "width":            1.8,    # m
        "max_roughness":    0.10,   # m (std)
        "label":            "Sedan",
        "color":            "#3498db",
    },
    "suv": {
        "ground_clearance": 0.22,
        "wheel_radius":     0.38,
        "width":            2.0,
        "max_roughness":    0.20,
        "label":            "SUV",
        "color":            "#2ecc71",
    },
    "truck": {
        "ground_clearance": 0.35,
        "wheel_radius":     0.55,
        "width":            2.5,
        "max_roughness":    0.35,
        "label":            "Truck",
        "color":            "#e67e22",
    },
}


def get_vehicle(vehicle_type: str) -> Dict:
    """Return the vehicle profile dict for `vehicle_type`."""
    vtype = vehicle_type.lower().strip()
    if vtype not in VEHICLE_PROFILES:
        raise ValueError(
            f"Unknown vehicle type '{vehicle_type}'. "
            f"Valid options: {list(VEHICLE_PROFILES.keys())}"
        )
    return VEHICLE_PROFILES[vtype]
