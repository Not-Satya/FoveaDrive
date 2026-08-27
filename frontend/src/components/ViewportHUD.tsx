// frontend/src/components/ViewportHUD.tsx

import { useState, type ReactNode } from 'react';
import { MappingMode, ScanMode, LookDir } from '../types';
import { MapCanvas } from './MapCanvas';
import type { GridCell } from '../api/foveadriveApi';

interface ViewportHUDProps {
  terrainStatus:     string;
  speed:             number;
  mappingMode:       MappingMode;
  toggleMappingMode: () => void;
  scanMode:          ScanMode;
  toggleScanMode:    () => void;
  lookDir:           LookDir;
  toggleLookDir:     () => void;
  cells:             GridCell[];
  loading:           boolean;
  heading?:          number;
  elevation?:        number;
  playing?:          boolean;
}

const HEAT_GRADIENT =
  'linear-gradient(90deg, rgb(40,200,255), rgb(24,120,230), rgb(16,40,125), rgb(150,32,200), rgb(255,80,214))';

export function ViewportHUD({
  terrainStatus,
  speed,
  mappingMode,
  toggleMappingMode,
  scanMode,
  toggleScanMode,
  lookDir,
  toggleLookDir,
  cells,
  loading,
  heading = 359.7,
  elevation = 2.4,
  playing = false,
}: ViewportHUDProps) {
  const isHazardous = terrainStatus === 'HAZARDOUS / UNTRAVERSABLE';
  const isCaution = terrainStatus.includes('CAUTION');
  const [viewYaw, setViewYaw] = useState(Math.PI / 5);
  const viewDeg = ((viewYaw * 180) / Math.PI % 360 + 360) % 360;

  return (
    <section
      className={`h-full w-full relative overflow-hidden flex flex-col bg-[#05080f] transition-all duration-1000 ${
        isHazardous ? 'shadow-[inset_0_0_180px_rgba(236,36,176,0.14)]' : ''
      }`}
    >
      <div className="absolute inset-0 z-10">
        <MapCanvas
          cells={cells}
          loading={loading}
          mappingMode={mappingMode}
          scanMode={scanMode}
          lookDir={lookDir}
          onViewChange={(yaw) => setViewYaw(yaw)}
        />
      </div>

      {/* ── Left HUD: speed, terrain analysis, legend ────────────────────── */}
      <div className="absolute left-4 top-14 z-20 pointer-events-none flex flex-col gap-3">
        <div className="text-[10px] font-mono tracking-widest text-icy-blue/70 uppercase tabular-nums">
          SYSTEM_SPEED: <span className="text-icy-blue">{speed.toFixed(1)} KM/H</span>
        </div>
        <div className="text-[10px] font-mono tracking-widest text-icy-blue/55 uppercase tabular-nums">
          GRID: <span className="text-icy-blue">{cells.length.toLocaleString()} cells</span>
          {scanMode === 'windshield' ? (
            <span className="text-emerald-400"> · 120° {lookDir === 'rear' ? 'REAR' : 'FRONT'}</span>
          ) : (
            <span className="text-icy-blue/45"> · 360°</span>
          )}
        </div>

        <div
          className={`w-fit px-3 py-2 border backdrop-blur-sm ${
            isHazardous || isCaution
              ? 'border-[#F472B6]/70 bg-[#2a1024]/55 text-[#F9A8D4]'
              : 'border-[#2B4C6F]/70 bg-[#060B14]/50 text-icy-blue/80'
          }`}
        >
          <div className="text-[8px] tracking-[0.2em] uppercase text-icy-blue/40 mb-1">Terrain analysis · path ahead</div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase">
            {(isHazardous || isCaution) && (
              <span className="material-symbols-outlined text-[14px] text-[#F472B6]">warning</span>
            )}
            {terrainStatus}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-[9px] font-mono tracking-widest uppercase text-icy-blue/50">
          {mappingMode === 'RAW_POINT_CLOUD' ? (
            <>
              <div className="text-[8px] text-icy-blue/35">Visual legend — GT overlay (not inferred)</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: 'rgb(20,50,130)' }} />Road</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: 'rgb(255,80,214)' }} />Vehicle</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: 'rgb(90,40,160)' }} />Building</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2" style={{ background: 'rgb(20,140,150)' }} />Veg</span>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 border border-icy-blue/50 flex items-center justify-center">
              <span className="size-1.5 bg-icy-blue/80" />
            </span>
            <span>Width limit</span>
          </div>
        </div>
      </div>

      {/* ── Right HUD: mode + compass ────────────────────────────────────── */}
      <div className="absolute top-14 right-4 z-20 flex flex-col items-end gap-3">
        <div className="relative">
          <button
            onClick={toggleScanMode}
            className={`text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 border transition-colors duration-[600ms] ease-[cubic-bezier(0.33,0,0.2,1)] backdrop-blur-sm ${
              scanMode === 'windshield'
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300'
                : 'border-[#2B4C6F]/50 bg-[#060B14]/50 text-icy-blue/60 hover:text-icy-blue/90 hover:border-[#2B4C6F]'
            }`}
          >
            SCAN: {scanMode === 'windshield' ? 'WINDSHIELD 120°' : 'SURROUND 360°'}
          </button>
          <div className="absolute right-full top-0 mr-2">
            <SlideReveal open={scanMode === 'windshield'} axis="x">
              <LookToggle lookDir={lookDir} onToggle={toggleLookDir} />
            </SlideReveal>
          </div>
        </div>
        <button
          onClick={toggleMappingMode}
          className="text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 border border-[#2B4C6F]/50 bg-[#060B14]/50 text-icy-blue/60 hover:text-icy-blue/90 hover:border-[#2B4C6F] transition-colors duration-[600ms] ease-[cubic-bezier(0.33,0,0.2,1)] backdrop-blur-sm"
        >
          MODE: {mappingMode === 'RAW_POINT_CLOUD' ? 'GT OVERLAY' : 'DRIVABILITY_MAP'}
        </button>
        <div className="relative h-0 w-full">
          <div className="absolute right-0 top-2">
            <SlideReveal open={playing}>
              <div className="text-[9px] font-mono tracking-[0.2em] uppercase px-3 py-1 border border-emerald-400/50 bg-emerald-500/10 text-emerald-300 whitespace-nowrap">
                DATASET PLAYBACK
              </div>
            </SlideReveal>
          </div>
        </div>
        <div className="text-[8px] font-mono tracking-widest uppercase text-icy-blue/40 text-right pointer-events-none">
          scroll to zoom · {scanMode === 'windshield' ? 'peek yaw ·' : 'drag to orbit ·'} dbl-click reset
        </div>

        <div className="pointer-events-none w-[7.5rem] h-[7.5rem] relative">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="rgba(6,11,20,0.45)" stroke="rgba(43,76,111,0.7)" strokeWidth="1" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(188,227,255,0.18)" strokeWidth="0.6" />
            <g transform={`rotate(${-viewDeg} 50 50)`}>
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
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
            <div className="text-[11px] text-icy-blue tabular-nums tracking-wider">{viewDeg.toFixed(1)}°</div>
            <div className="text-[8px] text-icy-blue/50 uppercase tracking-widest">
              {scanMode === 'windshield' ? (lookDir === 'rear' ? 'rear view' : 'windshield') : 'view yaw'}
            </div>
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

const HUD_SHIFT =
  'transform 560ms cubic-bezier(0.37, 0, 0.63, 1), opacity 420ms cubic-bezier(0.37, 0, 0.63, 1)';

export function SlideReveal({
  open,
  axis = 'y',
  children,
}: {
  open: boolean;
  axis?: 'x' | 'y';
  children: ReactNode;
}) {
  const hidden = axis === 'x' ? 'translate3d(14px,0,0)' : 'translate3d(0,12px,0)';
  return (
    <div
      className={open ? undefined : 'pointer-events-none'}
      style={{
        transform: open ? 'translate3d(0,0,0)' : hidden,
        opacity: open ? 1 : 0,
        transition: HUD_SHIFT,
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

export function HudSwitch({
  on,
  onColor = 'emerald',
}: {
  on: boolean;
  onColor?: 'emerald' | 'amber';
}) {
  return (
    <span
      className={`hud-switch hud-switch--${onColor}${on ? ' is-on' : ''}`}
      aria-hidden
    >
      <span className="hud-switch-knob" />
    </span>
  );
}

export function HudSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="hud-range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ ['--pct' as string]: `${pct}%` }}
    />
  );
}

export function LookToggle({
  lookDir,
  onToggle,
  className = '',
}: {
  lookDir: LookDir;
  onToggle: () => void;
  className?: string;
}) {
  const rear = lookDir === 'rear';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={rear}
      className={`inline-flex w-[9.75rem] items-center justify-between gap-2.5 border px-3 py-1.5 leading-none uppercase tracking-widest text-[10px] transition-colors backdrop-blur-sm ${
        rear
          ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
          : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300'
      } ${className}`}
    >
      <span className="tabular-nums leading-none">{rear ? 'REAR' : 'FRONT'}</span>
      <HudSwitch on={rear} onColor={rear ? 'amber' : 'emerald'} />
    </button>
  );
}
