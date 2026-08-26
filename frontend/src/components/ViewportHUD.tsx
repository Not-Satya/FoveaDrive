// frontend/src/components/ViewportHUD.tsx

import { MappingMode } from '../types';
import { MapCanvas } from './MapCanvas';
import type { GridCell } from '../api/foveadriveApi';

interface ViewportHUDProps {
  terrainStatus:     string;
  speed:             number;
  mappingMode:       MappingMode;
  toggleMappingMode: () => void;
  cells:             GridCell[];
  loading:           boolean;
  heading?:          number;
  elevation?:        number;
}

const HEAT_GRADIENT =
  'linear-gradient(90deg, rgb(40,200,255), rgb(24,120,230), rgb(16,40,125), rgb(150,32,200), rgb(255,80,214))';

export function ViewportHUD({
  terrainStatus,
  speed,
  mappingMode,
  toggleMappingMode,
  cells,
  loading,
  heading = 359.7,
  elevation = 2.4,
}: ViewportHUDProps) {
  const isHazardous = terrainStatus === 'HAZARDOUS / UNTRAVERSABLE';
  const isCaution = terrainStatus.includes('CAUTION');

  return (
    <section
      className={`h-full w-full relative overflow-hidden flex flex-col bg-[#05080f] transition-all duration-1000 ${
        isHazardous ? 'shadow-[inset_0_0_180px_rgba(236,36,176,0.14)]' : ''
      }`}
    >
      <div className="scanline pointer-events-none z-30" />

      <div className="absolute inset-0 z-10">
        <MapCanvas cells={cells} loading={loading} />
      </div>

      {/* ── Left HUD: speed, terrain analysis, legend ────────────────────── */}
      <div className="absolute left-4 top-10 z-20 pointer-events-none flex flex-col gap-3">
        <div className="text-[10px] font-mono tracking-widest text-icy-blue/70 uppercase tabular-nums">
          SYSTEM_SPEED: <span className="text-icy-blue">{speed.toFixed(1)} KM/H</span>
        </div>

        <div
          className={`w-fit px-3 py-2 border backdrop-blur-sm ${
            isHazardous || isCaution
              ? 'border-[#F472B6]/70 bg-[#2a1024]/55 text-[#F9A8D4]'
              : 'border-[#2B4C6F]/70 bg-[#060B14]/50 text-icy-blue/80'
          }`}
        >
          <div className="text-[8px] tracking-[0.2em] uppercase text-icy-blue/40 mb-1">Terrain analysis</div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase">
            <span className="material-symbols-outlined text-[14px] text-[#F472B6]">warning</span>
            {terrainStatus}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-[9px] font-mono tracking-widest uppercase text-icy-blue/50">
          <div className="text-[8px] text-icy-blue/35">Visual legend — signed height</div>
          <div className="flex items-center gap-2">
            <span>Pothole</span>
            <span
              className="h-1.5 w-[5.5rem] shrink-0 border border-[#2B4C6F]/60"
              style={{ background: HEAT_GRADIENT }}
            />
            <span>Obstacle</span>
          </div>
          <div className="text-[8px] text-icy-blue/35 tracking-wider">← below grade &nbsp; navy = 0 m &nbsp; above →</div>
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 border border-icy-blue/50 flex items-center justify-center">
              <span className="size-1.5 bg-icy-blue/80" />
            </span>
            <span>Width limit</span>
          </div>
        </div>
      </div>

      {/* ── Right HUD: mode + compass ────────────────────────────────────── */}
      <div className="absolute top-10 right-4 z-20 flex flex-col items-end gap-3">
        <button
          onClick={toggleMappingMode}
          className="text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 border border-[#2B4C6F]/50 bg-[#060B14]/50 text-icy-blue/60 hover:text-icy-blue/90 hover:border-[#2B4C6F] transition-all backdrop-blur-sm"
        >
          MODE: {mappingMode === 'RAW_POINT_CLOUD' ? 'RAW_POINT_CLOUD' : 'DRIVABILITY_MAP'}
        </button>

        <div className="pointer-events-none w-[7.5rem] h-[7.5rem] relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="rgba(6,11,20,0.45)" stroke="rgba(43,76,111,0.7)" strokeWidth="1" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(188,227,255,0.18)" strokeWidth="0.6" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const a = ((deg - 90) * Math.PI) / 180;
              const x1 = 50 + Math.cos(a) * 40;
              const y1 = 50 + Math.sin(a) * 40;
              const x2 = 50 + Math.cos(a) * 44;
              const y2 = 50 + Math.sin(a) * 44;
              return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(188,227,255,0.45)" strokeWidth="1" />;
            })}
            <polygon points="50,12 47,28 50,24 53,28" fill="#BCE3FF" />
            <text x="50" y="22" textAnchor="middle" fill="#BCE3FF" fontSize="6" fontFamily="Space Mono">N</text>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
            <div className="text-[11px] text-icy-blue tabular-nums tracking-wider">{heading.toFixed(1)}°</div>
            <div className="text-[8px] text-icy-blue/50 uppercase tracking-widest">+{elevation.toFixed(1)} m</div>
          </div>
        </div>
      </div>

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
