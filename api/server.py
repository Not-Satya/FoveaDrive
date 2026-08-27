# backend/api/server.py

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
import time
import sys
import os

# Make sure imports resolve from project root when running via uvicorn
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import (
    run_pipeline,
    run_custom_pipeline,
    build_stats,
    invalidate_base_grid,
    set_active_frame,
    set_scan_mode,
    set_look_dir,
    get_dataset_info,
)
from config import DATA_CONFIG
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
# Simple in-process cache keyed by vehicle + scan mode
# ---------------------------------------------------------------------------
_cache: Dict[str, List[Dict]] = {}


def _cache_key(vehicle: str) -> str:
    mode = DATA_CONFIG.get("scan_mode", "surround")
    look = DATA_CONFIG.get("look_dir", "front") if mode == "windshield" else "front"
    return f"{vehicle}|{mode}|{look}"


def _get_cached(vehicle: str) -> List[Dict]:
    key = _cache_key(vehicle)
    if key not in _cache:
        _cache[key] = run_pipeline(vehicle)
    return _cache[key]


def _apply_frame(frame: Optional[str]) -> None:
    """Switch the active LiDAR frame when the client asks; drop vehicle cache if it changed."""
    if not frame:
        return
    if set_active_frame(frame):
        _cache.clear()


def _apply_scan(scan: Optional[str], look: Optional[str] = None) -> None:
    """Switch surround vs windshield and optional front/rear look."""
    if scan:
        raw = scan.strip().lower()
        set_scan_mode(scan)
        if raw in ("rear", "back", "behind", "reverse"):
            set_look_dir("rear")
    if look:
        set_look_dir(look)


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


@app.get("/dataset")
def get_dataset():
    """Curated KITTI/SemanticKITTI catalog plus the frame currently loaded."""
    return get_dataset_info()


@app.get("/map")
def get_map(
    vehicle: str = Query(default="sedan", description="sedan | suv | truck"),
    frame: Optional[str] = Query(default=None, description="frame_000000 | synthetic"),
    scan: Optional[str] = Query(default=None, description="surround | windshield"),
    look: Optional[str] = Query(default=None, description="front | rear (windshield only)"),
):
    """Full grid cells for a preset vehicle profile."""
    try:
        get_vehicle(vehicle)
        _apply_frame(frame)
        _apply_scan(scan, look)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _get_cached(vehicle)


@app.get("/map/stats")
def get_map_stats(
    vehicle: str = Query(default="sedan", description="sedan | suv | truck"),
    frame: Optional[str] = Query(default=None, description="frame_000000 | synthetic"),
    scan: Optional[str] = Query(default=None, description="surround | windshield"),
    look: Optional[str] = Query(default=None, description="front | rear (windshield only)"),
):
    """Summary statistics for a preset vehicle type."""
    try:
        get_vehicle(vehicle)
        _apply_frame(frame)
        _apply_scan(scan, look)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return build_stats(_get_cached(vehicle), vehicle_label=vehicle)


@app.get("/map/custom")
def get_map_custom(
    ground_clearance: float          = Query(...,  description="Ground clearance in metres e.g. 0.25"),
    width:            float          = Query(...,  description="Vehicle width in metres e.g. 1.8"),
    wheel_radius:     float          = Query(...,  description="Wheel radius in metres e.g. 0.32"),
    max_roughness:    Optional[float] = Query(None, description="Height-std tolerance (auto-derived if omitted)"),
    frame:            Optional[str]  = Query(None, description="frame_000000 | synthetic"),
    scan:             Optional[str]  = Query(None, description="surround | windshield"),
    look:             Optional[str]  = Query(None, description="front | rear (windshield only)"),
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

    try:
        _apply_frame(frame)
        _apply_scan(scan, look)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    """Force-clear the pipeline cache and rebuild the base grid."""
    _cache.clear()
    invalidate_base_grid()
    return {"message": "Cache cleared"}
