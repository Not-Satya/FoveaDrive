// frontend/src/hooks/useHUDState.ts
//
// Central HUD state — live map data from the backend + curated KITTI frames.

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import { VehicleProfile, KinematicParams, TelemetryData, MappingMode } from '../types';
import {
  fetchMap,
  fetchCustomMap,
  fetchDataset,
  GridCell,
  LidarFrame,
  DatasetCurrent,
} from '../api/foveadriveApi';

const PROFILES: Record<VehicleProfile, KinematicParams> = {
  SEDAN: { groundClearance: 15, chassisWidth: 1.8, wheelRadius: 32, curbWeight: 1.5 },
  SUV:   { groundClearance: 22, chassisWidth: 2.0, wheelRadius: 38, curbWeight: 2.2 },
  TRUCK: { groundClearance: 35, chassisWidth: 2.5, wheelRadius: 55, curbWeight: 3.5 },
};

const cmToM = (cm: number) => Math.round((cm / 100) * 1000) / 1000;

function toTerrainStatus(pct: number): string {
  if (pct >= 70) return 'SAFE / DRIVABLE';
  if (pct >= 40) return 'CAUTION / PARTIAL';
  return 'HAZARDOUS / UNTRAVERSABLE';
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function bumpMapHz(
  tick: { n: number; t: number },
  setTelemetry: Dispatch<SetStateAction<TelemetryData>>,
) {
  tick.n += 1;
  const now = performance.now();
  if (now - tick.t < 1000) return;
  const hz = tick.n / ((now - tick.t) / 1000);
  tick.n = 0;
  tick.t = now;
  setTelemetry(t => ({
    ...t,
    mapHz: hz,
    busStatus: `Dataset playback ${hz.toFixed(1)} Hz`,
  }));
}

function streamLabel(current: DatasetCurrent | null): string {
  if (!current || current.source === 'synthetic') return 'Simulated LiDAR Point Cloud';
  const pts = current.point_count ? `${current.point_count.toLocaleString()} pts` : '';
  const seq = current.sequence ? `seq${current.sequence}` : 'KITTI';
  return `KITTI ${seq} · ${current.frame_id ?? ''} · ${pts}`.replace(/ · $/, '');
}

export function useHUDState() {
  const [activeProfile,   setActiveProfile]   = useState<VehicleProfile>('SEDAN');
  const [kinematicParams, setKinematicParams] = useState<KinematicParams>(PROFILES.SEDAN);
  const [mappingMode,     setMappingMode]     = useState<MappingMode>('RAW_POINT_CLOUD');

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    fpsRate: 59.8,
    mapHz: 0,
    busStatus: 'Geometric classifier',
    inputStream: 'KITTI HDL-64E',
    lat: 45.4216,
    lng: 75.6972,
    friction: 0.82,
    incline: 2.4,
  });

  const [cells,         setCells]         = useState<GridCell[]>([]);
  const [drivablePct,   setDrivablePct]   = useState<number>(100);
  const [terrainStatus, setTerrainStatus] = useState<string>('SAFE / DRIVABLE');
  const [mapLoading,    setMapLoading]    = useState(false);

  const [frames,          setFrames]          = useState<LidarFrame[]>([]);
  const [frameId,         setFrameId]         = useState('frame_000000');
  const [datasetCurrent,  setDatasetCurrent]  = useState<DatasetCurrent | null>(null);
  const [catalogReady,    setCatalogReady]    = useState(false);

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const mapTickRef = useRef({ n: 0, t: performance.now() });
  const debouncedParams = useDebounce(kinematicParams, 400);

  const fpsRef   = useRef<number>(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    let last = performance.now();
    let framesCount = 0;
    const loop = (now: number) => {
      framesCount++;
      if (now - last >= 1000) {
        fpsRef.current = framesCount;
        setTelemetry(t => ({ ...t, fpsRate: framesCount }));
        framesCount = 0;
        last = now;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDataset()
      .then((d) => {
        if (cancelled) return;
        setFrames(d.frames);
        setDatasetCurrent(d.current);
        const next = d.current.source === 'synthetic'
          ? 'synthetic'
          : (d.current.frame_id || 'frame_000000');
        setFrameId(next);
        setTelemetry(t => ({
          ...t,
          inputStream: streamLabel(d.current),
          busStatus: playingRef.current ? t.busStatus : 'Geometric classifier + GT overlay',
        }));
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setCatalogReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const meta = frames.find(f => f.id === frameId);
    if (!meta) return;
    const current: DatasetCurrent = {
      source: frameId === 'synthetic' ? 'synthetic' : 'kitti',
      frame_id: frameId === 'synthetic' ? null : frameId,
      point_count: datasetCurrent?.frame_id === frameId ? datasetCurrent.point_count : null,
      labeled: frameId !== 'synthetic',
      sequence: meta.sequence,
      category: meta.category,
      difficulty: meta.difficulty,
      special: meta.special,
    };
    setDatasetCurrent(current);
    setTelemetry(t => ({
      ...t,
      inputStream: streamLabel(current),
      busStatus: playingRef.current
        ? t.busStatus
        : (current.labeled ? 'Geometric classifier + GT overlay' : 'Height-only cloud'),
    }));
  }, [frameId, frames]);

  useEffect(() => {
    if (!catalogReady) return;
    if (isCustomMode) return;
    let cancelled = false;
    setMapLoading(true);
    fetchMap(activeProfile, frameId)
      .then(data => {
        if (cancelled) return;
        setCells(data);
        const pct = data.length
          ? Math.round(data.filter(c => c.drivable).length / data.length * 100)
          : 100;
        setDrivablePct(pct);
        setTerrainStatus(toTerrainStatus(pct));
        if (playingRef.current) bumpMapHz(mapTickRef.current, setTelemetry);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setMapLoading(false); });
    return () => { cancelled = true; };
  }, [activeProfile, isCustomMode, frameId, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    if (!isCustomMode) return;
    let cancelled = false;
    setMapLoading(true);
    fetchCustomMap({
      ground_clearance: cmToM(debouncedParams.groundClearance),
      width:            debouncedParams.chassisWidth,
      wheel_radius:     cmToM(debouncedParams.wheelRadius),
      frame:            frameId,
    })
      .then(({ cells: data, stats }) => {
        if (cancelled) return;
        setCells(data);
        setDrivablePct(stats.drivable_pct);
        setTerrainStatus(toTerrainStatus(stats.drivable_pct));
        if (playingRef.current) bumpMapHz(mapTickRef.current, setTelemetry);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setMapLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedParams, isCustomMode, frameId, catalogReady]);

  useEffect(() => {
    if (!playing || !catalogReady) return;
    const list = frames.filter(f => f.id !== 'synthetic');
    if (list.length < 2) return;
    if (frameId === 'synthetic') {
      setFrameId(list[0].id);
      return;
    }
    if (mapLoading) return;
    const id = window.setTimeout(() => {
      const idx = list.findIndex(f => f.id === frameId);
      setFrameId(list[idx < 0 ? 0 : (idx + 1) % list.length].id);
    }, 40);
    return () => clearTimeout(id);
  }, [playing, catalogReady, mapLoading, frameId, frames]);

  const handleProfileChange = useCallback((profile: VehicleProfile) => {
    setActiveProfile(profile);
    setKinematicParams(PROFILES[profile]);
    setIsCustomMode(false);
  }, []);

  const handleParamChange = useCallback((key: keyof KinematicParams, value: number) => {
    setKinematicParams(prev => ({ ...prev, [key]: value }));
    setIsCustomMode(true);
  }, []);

  const handleFrameChange = useCallback((id: string) => {
    setFrameId(id);
  }, []);

  const cycleFrame = useCallback((dir: -1 | 1) => {
    if (frames.length === 0) return;
    const idx = Math.max(0, frames.findIndex(f => f.id === frameId));
    const next = frames[(idx + dir + frames.length) % frames.length];
    setFrameId(next.id);
  }, [frames, frameId]);

  const togglePlayback = useCallback(() => {
    setPlaying(p => {
      if (!p) mapTickRef.current = { n: 0, t: performance.now() };
      return !p;
    });
  }, []);

  const toggleMappingMode = useCallback(() => {
    setMappingMode(m => m === 'RAW_POINT_CLOUD' ? 'DRIVABILITY_MAP' : 'RAW_POINT_CLOUD');
  }, []);

  useEffect(() => {
    if (playing) return;
    setTelemetry(t => ({
      ...t,
      mapHz: 0,
      busStatus: 'Geometric classifier + GT overlay',
    }));
  }, [playing]);

  return {
    activeProfile, kinematicParams,
    mappingMode, toggleMappingMode,
    telemetry,
    cells, drivablePct, terrainStatus, mapLoading,
    frames, frameId, datasetCurrent,
    playing, togglePlayback,
    handleProfileChange, handleParamChange, handleFrameChange, cycleFrame,
    speed: telemetry.fpsRate > 0 ? 43.9 : 0,
  };
}
