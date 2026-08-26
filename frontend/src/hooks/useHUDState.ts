// frontend/src/hooks/useHUDState.ts
//
// Central HUD state — extended to fetch live map data from the backend.

import { useState, useEffect, useRef, useCallback } from 'react';
import { VehicleProfile, KinematicParams, TelemetryData, MappingMode } from '../types';
import { fetchMap, fetchCustomMap, GridCell } from '../api/foveadriveApi';

// ── Default profile params ────────────────────────────────────────────────────
const PROFILES: Record<VehicleProfile, KinematicParams> = {
  SEDAN: { groundClearance: 15, chassisWidth: 1.8, wheelRadius: 32, curbWeight: 1.5 },
  SUV:   { groundClearance: 22, chassisWidth: 2.0, wheelRadius: 38, curbWeight: 2.2 },
  TRUCK: { groundClearance: 35, chassisWidth: 2.5, wheelRadius: 55, curbWeight: 3.5 },
};

// ── Unit helpers (UI uses cm for clearance/radius, API uses metres) ───────────
const cmToM = (cm: number) => Math.round((cm / 100) * 1000) / 1000;

// ── Terrain label derived from drivability % ──────────────────────────────────
function toTerrainStatus(pct: number): string {
  if (pct >= 70) return 'SAFE / DRIVABLE';
  if (pct >= 40) return 'CAUTION / PARTIAL';
  return 'HAZARDOUS / UNTRAVERSABLE';
}

// ── Debounce helper ───────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// =============================================================================
export function useHUDState() {
  // ── UI state (managed by ControlPanel) ──────────────────────────────────────
  const [activeProfile,   setActiveProfile]   = useState<VehicleProfile>('SEDAN');
  const [kinematicParams, setKinematicParams] = useState<KinematicParams>(PROFILES.SEDAN);
  const [mappingMode,     setMappingMode]     = useState<MappingMode>('RAW_POINT_CLOUD');

  // ── Telemetry ─────────────────────────────────────────────────────────────
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    fpsRate: 59.8,
    busStatus: 'Ultrasonic Scanner Active',
    inputStream: 'Simulated LiDAR Point Cloud',
    lat: 45.4216,
    lng: 75.6972,
    friction: 0.82,
    incline: 2.4,
  });

  // ── Map data (from backend) ────────────────────────────────────────────────
  const [cells,        setCells]        = useState<GridCell[]>([]);
  const [drivablePct,  setDrivablePct]  = useState<number>(100);
  const [terrainStatus, setTerrainStatus] = useState<string>('SAFE / DRIVABLE');
  const [mapLoading,   setMapLoading]   = useState(false);

  // Track whether the user has manually tweaked sliders away from the preset
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Debounce slider changes so we don't hammer the API on every pixel of drag
  const debouncedParams = useDebounce(kinematicParams, 400);

  // ── FPS counter ────────────────────────────────────────────────────────────
  const fpsRef   = useRef<number>(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    let last = performance.now();
    let frames = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        fpsRef.current = frames;
        setTelemetry(t => ({ ...t, fpsRate: frames }));
        frames = 0;
        last = now;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // ── Fetch when profile button clicked (preset mode) ───────────────────────
  useEffect(() => {
    if (isCustomMode) return;
    setMapLoading(true);
    fetchMap(activeProfile)
      .then(data => {
        setCells(data);
        const pct = data.length
          ? Math.round(data.filter(c => c.drivable).length / data.length * 100)
          : 100;
        setDrivablePct(pct);
        setTerrainStatus(toTerrainStatus(pct));
      })
      .catch(console.error)
      .finally(() => setMapLoading(false));
  }, [activeProfile, isCustomMode]);

  // ── Fetch when sliders change (custom mode) ───────────────────────────────
  useEffect(() => {
    if (!isCustomMode) return;
    setMapLoading(true);
    fetchCustomMap({
      ground_clearance: cmToM(debouncedParams.groundClearance),
      width:            debouncedParams.chassisWidth,
      wheel_radius:     cmToM(debouncedParams.wheelRadius),
    })
      .then(({ cells: data, stats }) => {
        setCells(data);
        setDrivablePct(stats.drivable_pct);
        setTerrainStatus(toTerrainStatus(stats.drivable_pct));
      })
      .catch(console.error)
      .finally(() => setMapLoading(false));
  }, [debouncedParams, isCustomMode]);

  // ── Handlers for ControlPanel ─────────────────────────────────────────────
  const handleProfileChange = useCallback((profile: VehicleProfile) => {
    setActiveProfile(profile);
    setKinematicParams(PROFILES[profile]);
    setIsCustomMode(false);   // snap back to preset fetch
  }, []);

  const handleParamChange = useCallback((key: keyof KinematicParams, value: number) => {
    setKinematicParams(prev => ({ ...prev, [key]: value }));
    setIsCustomMode(true);    // switch to custom fetch
  }, []);

  const toggleMappingMode = useCallback(() => {
    setMappingMode(m => m === 'RAW_POINT_CLOUD' ? 'DRIVABILITY_MAP' : 'RAW_POINT_CLOUD');
  }, []);

  return {
    // UI state
    activeProfile, kinematicParams,
    mappingMode, toggleMappingMode,
    telemetry,
    // Map data
    cells, drivablePct, terrainStatus, mapLoading,
    // Handlers
    handleProfileChange, handleParamChange,
    // Derived speed (simulated — matches original telemetry)
    speed: telemetry.fpsRate > 0 ? 43.9 : 0,
  };
}
