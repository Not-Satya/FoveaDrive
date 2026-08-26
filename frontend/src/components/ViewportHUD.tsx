// frontend/src/components/ViewportHUD.tsx

import { MappingMode } from '../types';
import { MapCanvas } from './MapCanvas';
import type { GridCell } from '../api/foveadriveApi';

interface ViewportHUDProps {
  terrainStatus:    string;
  speed:            number;
  mappingMode:      MappingMode;
  toggleMappingMode: () => void;
  cells:            GridCell[];
  loading:          boolean;
}

export function ViewportHUD({
  terrainStatus,
  speed,
  mappingMode,
  toggleMappingMode,
  cells,
  loading,
}: ViewportHUDProps) {
  const isHazardous = terrainStatus === 'HAZARDOUS / UNTRAVERSABLE';

  return (
    <section
      className={`h-full w-full relative overflow-hidden flex flex-col bg-[#05080f] transition-all duration-1000 ${
        isHazardous ? 'shadow-[inset_0_0_200px_rgba(239,68,68,0.12)]' : ''
      }`}
    >
      {/* ── Scanline animation ───────────────────────────────────────────── */}
      <div className="scanline pointer-events-none z-30" />

      {/* ── Map canvas (fills the entire viewport) ───────────────────────── */}
      <div className="absolute inset-0 z-10">
        <MapCanvas cells={cells} loading={loading} />
      </div>

      {/* ── Left-side HUD column — speed + terrain ───────────────────────── */}
      <div className="absolute left-0 top-8 px-4 py-2 flex flex-col gap-3 z-20 pointer-events-none">
        <div className="text-[10px] font-mono tracking-widest text-icy-blue/60 uppercase tabular-nums">
          SYSTEM_SPEED: <span className="text-icy-blue/90">{speed.toFixed(1)} km/h</span>
        </div>

        {/* Terrain boxed badge */}
        <div
          className={`text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 border backdrop-blur-sm transition-all duration-700 w-fit ${
            isHazardous
              ? 'border-red-500/60 bg-red-900/20 text-red-400'
              : 'border-[#2B4C6F]/70 bg-[#060B14]/50 text-icy-blue/80'
          }`}
        >
          TERRAIN: {terrainStatus}
        </div>
      </div>

      {/* ── Mapping mode toggle (top-right) ──────────────────────────────── */}
      <button
        onClick={toggleMappingMode}
        className="absolute top-4 right-4 z-20 text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 border border-[#2B4C6F]/50 bg-[#060B14]/50 text-icy-blue/60 hover:text-icy-blue/90 hover:border-[#2B4C6F] transition-all backdrop-blur-sm"
      >
        MODE: {mappingMode === 'RAW_POINT_CLOUD' ? 'RAW_POINT_CLOUD' : 'DRIVABILITY_MAP'}
      </button>

      {/* ── Corner brackets (HUD aesthetic) ─────────────────────────────── */}
      {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
        <div
          key={i}
          className={`absolute ${pos} w-4 h-4 border-icy-blue/20 pointer-events-none z-20 ${
            i === 0 ? 'border-t border-l'
            : i === 1 ? 'border-t border-r'
            : i === 2 ? 'border-b border-l'
            : 'border-b border-r'
          }`}
        />
      ))}
    </section>
  );
}
