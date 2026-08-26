# backend/api/server.py

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
import time
import sys
import os

# Make sure imports resolve from project root when running via uvicorn
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import run_pipeline, run_custom_pipeline, build_stats
from models.vehicle import VEHICLE_PROFILES, get_vehicle

# ---------------------------------------------------------------------------
# App init
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FoveaDrive API",
    description="Adaptive 2.5D Mapping with Vehicle-Aware Drivability",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS  (open for hackathon — tighten for production)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Simple in-process cache keyed by vehicle type
# ---------------------------------------------------------------------------
_cache: Dict[str, List[Dict]] = {}


def _get_cached(vehicle: str) -> List[Dict]:
    if vehicle not in _cache:
        _cache[vehicle] = run_pipeline(vehicle)
    return _cache[vehicle]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    """Liveness check."""
    return {"status": "ok", "message": "FoveaDrive API is running", "timestamp": time.time()}


@app.get("/vehicles")
def list_vehicles():
    """Return all available vehicle profiles."""
    return {vtype: {**profile, "id": vtype} for vtype, profile in VEHICLE_PROFILES.items()}


@app.get("/vehicle/{vehicle_type}")
def get_vehicle_profile(vehicle_type: str):
    """Return a single vehicle profile by type."""
    try:
        return {**get_vehicle(vehicle_type), "id": vehicle_type}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/map")
def get_map(
    vehicle: str = Query(default="sedan", description="sedan | suv | truck"),
):
    """Full grid cells for a preset vehicle profile."""
    try:
        get_vehicle(vehicle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _get_cached(vehicle)


@app.get("/map/stats")
def get_map_stats(
    vehicle: str = Query(default="sedan", description="sedan | suv | truck"),
):
    """Summary statistics for a preset vehicle type."""
    try:
        get_vehicle(vehicle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return build_stats(_get_cached(vehicle), vehicle_label=vehicle)


@app.get("/map/custom")
def get_map_custom(
    ground_clearance: float          = Query(...,  description="Ground clearance in metres e.g. 0.25"),
    width:            float          = Query(...,  description="Vehicle width in metres e.g. 1.8"),
    wheel_radius:     float          = Query(...,  description="Wheel radius in metres e.g. 0.32"),
    max_roughness:    Optional[float] = Query(None, description="Height-std tolerance (auto-derived if omitted)"),
):
    """
    Run the pipeline with fully custom vehicle parameters — used by the
    Kinematic Calibration sliders in the UI.

    Returns cells + stats in one response so the slider only needs
    a single fetch per change:

        { params: {...}, stats: {...}, cells: [...] }
    """
    if not (0.01 <= ground_clearance <= 2.0):
        raise HTTPException(status_code=400, detail="ground_clearance must be 0.01 – 2.0 m")
    if not (0.5  <= width            <= 5.0):
        raise HTTPException(status_code=400, detail="width must be 0.5 – 5.0 m")
    if not (0.1  <= wheel_radius     <= 1.0):
        raise HTTPException(status_code=400, detail="wheel_radius must be 0.1 – 1.0 m")

    cells = run_custom_pipeline(
        ground_clearance=ground_clearance,
        width=width,
        wheel_radius=wheel_radius,
        max_roughness=max_roughness,
    )

    effective_roughness = max_roughness if max_roughness is not None else round(ground_clearance * 0.6, 3)

    return {
        "params": {
            "ground_clearance": ground_clearance,
            "width":            width,
            "wheel_radius":     wheel_radius,
            "max_roughness":    effective_roughness,
        },
        "stats": build_stats(cells, vehicle_label="custom"),
        "cells": cells,
    }


@app.post("/cache/clear")
def clear_cache():
    """Force-clear the pipeline cache."""
    _cache.clear()
    return {"message": "Cache cleared"}
