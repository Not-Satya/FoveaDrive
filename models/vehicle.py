# backend/models/vehicle.py

from typing import Dict


VEHICLE_PROFILES: Dict[str, Dict] = {
    "sedan": {
        "ground_clearance": 1.2
    },
    "suv": {
        "ground_clearance": 2.0
    },
    "truck": {
        "ground_clearance": 3.0
    }
}


def get_vehicle(name: str) -> Dict:
    if name not in VEHICLE_PROFILES:
        raise ValueError(f"Unknown vehicle type: {name}")
    return VEHICLE_PROFILES[name]