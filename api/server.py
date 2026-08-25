from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from functools import lru_cache
import time

from main import run_pipeline
from models.vehicle import VEHICLE_PROFILES

# -----------------------------
# APP INIT
# -----------------------------
app = FastAPI(
    title="FoveaDrive API",
    description="Adaptive 2.5D Mapping with Vehicle-Aware Drivability",
    version="1.0.0"
)

# -----------------------------
# CORS (IMPORTANT for frontend)
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for hackathon
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# CACHE (PER VEHICLE)
# -----------------------------
@lru_cache(maxsize=5)
def cached_pipeline(vehicle: str) -> List[Dict]:
    return run_pipeline(vehicle)


# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "message": "FoveaDrive API is running"
    }


# -----------------------------
# AVAILABLE VEHICLES
# -----------------------------
@app.get("/vehicles")
def get_vehicles():
    return {
        "available_vehicles": list(VEHICLE_PROFILES.keys())
    }


# -----------------------------
# MAIN MAP ENDPOINT
# -----------------------------
@app.get("/map")
def get_map(
    vehicle: str = Query("sedan", description="Vehicle type"),
    limit: int = Query(500, ge=1, le=5000, description="Max number of grid cells"),
    mode: str = Query("lite", description="lite or full")
):
    start_time = time.time()

    # Validate vehicle
    if vehicle not in VEHICLE_PROFILES:
        return {
            "error": f"Invalid vehicle. Choose from {list(VEHICLE_PROFILES.keys())}"
        }

    # Validate mode
    if mode not in ["lite", "full"]:
        return {
            "error": "Invalid mode. Use 'lite' or 'full'"
        }

    # Get processed data (cached)
    data = cached_pipeline(vehicle)
    data = data[:limit]

    # -----------------------------
    # MODE HANDLING
    # -----------------------------
    if mode == "lite":
        processed_data = [
            {
                "x": d["x"],
                "y": d["y"],
                "drivable": d["drivable"]
            }
            for d in data
        ]

    elif mode == "full":
        processed_data = [
            {
                "x": d["x"],
                "y": d["y"],
                "height": d["height"],
                "terrain": d["terrain"],
                "drivable": d["drivable"]
            }
            for d in data
        ]

    # -----------------------------
    # META INFO
    # -----------------------------
    total = len(data)
    drivable = sum(1 for d in data if d["drivable"])

    end_time = time.time()

    return {
        "meta": {
            "vehicle": vehicle,
            "mode": mode,
            "total_cells": total,
            "drivable_cells": drivable,
            "blocked_cells": total - drivable,
            "response_time_ms": round((end_time - start_time) * 1000, 2)
        },
        "data": processed_data
    }