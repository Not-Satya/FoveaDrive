import { useState, type ReactNode } from "react";
import { useHUDState } from "../hooks/useHUDState";
import { VehicleProfile } from "../types";
import { HudSlider, LookToggle, SlideReveal } from "./ViewportHUD";

const HUD_SHIFT =
  'transform 560ms cubic-bezier(0.37, 0, 0.63, 1), opacity 420ms cubic-bezier(0.37, 0, 0.63, 1)';

export function ControlPanel(
  props: ReturnType<typeof useHUDState> & {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    children?: ReactNode;
  },
) {
  const {
    activeProfile, kinematicParams, telemetry,
    handleProfileChange, handleParamChange,
    frames, frameId, datasetCurrent, handleFrameChange, cycleFrame,
    playing, togglePlayback,
    scanMode, setScan,
    lookDir, toggleLookDir,
    collapsed = false,
    onToggleCollapse,
    children,
  } = props;
  const [calibrationState, setCalibrationState] = useState<"idle" | "processing" | "complete">("idle");

  const handleRecalibrate = () => {
    if (calibrationState !== "idle") return;
    setCalibrationState("processing");
    setTimeout(() => {
      setCalibrationState("complete");
      setTimeout(() => {
        setCalibrationState("idle");
      }, 2000);
    }, 1500);
  };

  const profiles: VehicleProfile[] = ['SEDAN', 'SUV', 'TRUCK'];

  return (
    <div className="relative">
      <ShiftLayer open={collapsed} z={20}>
        <div className="flex justify-center pt-1">
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              className={`px-4 py-2 border backdrop-blur-md uppercase tracking-[0.2em] text-[10px] shadow-2xl ${
                playing
                  ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300'
                  : 'border-[#2B4C6F]/70 bg-[#060B14]/85 text-icy-blue/70 hover:text-icy-blue hover:border-[#E879F9]/50'
              }`}
            >
              {playing ? '■ PAUSE STREAM' : '▶ PLAY STREAM'}
            </button>
            <button
              type="button"
              onClick={() => setScan(scanMode === 'surround' ? 'windshield' : 'surround')}
              className={`px-4 py-2 border backdrop-blur-md uppercase tracking-[0.2em] text-[10px] shadow-2xl ${
                scanMode === 'windshield'
                  ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300'
                  : 'border-[#2B4C6F]/70 bg-[#060B14]/85 text-icy-blue/70 hover:text-icy-blue hover:border-[#E879F9]/50'
              }`}
            >
              {scanMode === 'windshield' ? '120° WINDSHIELD' : '360° SURROUND'}
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="px-4 py-2 border border-[#2B4C6F]/70 bg-[#060B14]/85 backdrop-blur-md text-icy-blue/70 hover:text-icy-blue hover:border-[#E879F9]/50 uppercase tracking-[0.2em] text-[10px] shadow-2xl"
            >
              ▴ SHOW CONTROLS
            </button>
            <div className="absolute left-full top-0 ml-2">
              <SlideReveal open={scanMode === 'windshield'} axis="x">
                <LookToggle lookDir={lookDir} onToggle={toggleLookDir} className="shadow-2xl whitespace-nowrap" />
              </SlideReveal>
            </div>
          </div>
        </div>
      </ShiftLayer>

      <ShiftLayer open={!collapsed} z={10}>
        <section className="bg-[#060B14]/95 p-4 rounded-xl border border-[#2B4C6F]/30 shadow-2xl">
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="px-3 py-1 border border-[#2B4C6F]/50 text-icy-blue/55 hover:text-icy-blue hover:border-[#E879F9]/40 uppercase tracking-[0.2em] text-[10px]"
        >
          ▾ COLLAPSE PANEL
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#2B4C6F] bg-[#102035]/80 px-4 py-2">
        <span className="text-[10px] text-icy-blue/50 uppercase tracking-widest shrink-0">LiDAR stream</span>
        <span className="text-[10px] text-icy-blue/45 font-mono tracking-wider truncate min-w-0">
          {datasetCurrent?.source === 'kitti'
            ? `diff ${datasetCurrent.difficulty ?? '—'} · ${datasetCurrent.special ? 'special' : 'urban/rest'}`
            : 'generated cloud'}
        </span>
        <button
          type="button"
          onClick={() => cycleFrame(-1)}
          className="px-2 py-1 border border-[#2B4C6F]/60 text-icy-blue/70 hover:text-icy-blue hover:border-[#E879F9]/50 text-[10px]"
        >
          ◀
        </button>
        <select
          value={frameId}
          onChange={(e) => handleFrameChange(e.target.value)}
          className="min-w-[12rem] flex-1 max-w-md bg-[#060B14] border border-[#2B4C6F]/60 text-icy-blue text-[10px] font-mono tracking-wider px-2 py-1.5 outline-none"
        >
          {frames.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id === 'synthetic'
                ? 'SYNTHETIC'
                : `${f.id.replace('frame_', '')}  seq${f.sequence ?? '--'}  ${f.category}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => cycleFrame(1)}
          className="px-2 py-1 border border-[#2B4C6F]/60 text-icy-blue/70 hover:text-icy-blue hover:border-[#E879F9]/50 text-[10px]"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={togglePlayback}
          className={`px-3 py-1.5 border uppercase tracking-widest text-[10px] ${
            playing
              ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300'
              : 'border-[#2B4C6F]/60 text-icy-blue/70 hover:text-icy-blue hover:border-[#E879F9]/50'
          }`}
        >
          {playing ? '■ PAUSE' : '▶ PLAY'}
        </button>
        <div className="flex border border-[#2B4C6F]/60 shrink-0">
          <button
            type="button"
            onClick={() => setScan('surround')}
            className={`px-3 py-1.5 uppercase tracking-widest text-[10px] ${
              scanMode === 'surround'
                ? 'bg-icy-blue/15 text-icy-blue'
                : 'text-icy-blue/45 hover:text-icy-blue'
            }`}
          >
            360°
          </button>
          <button
            type="button"
            onClick={() => setScan('windshield')}
            className={`px-3 py-1.5 uppercase tracking-widest text-[10px] border-l border-[#2B4C6F]/60 ${
              scanMode === 'windshield'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-icy-blue/45 hover:text-icy-blue'
            }`}
          >
            120° FOV
          </button>
        </div>
        <div className="w-[9.75rem] shrink-0">
          <SlideReveal open={scanMode === 'windshield'} axis="x">
            <LookToggle lookDir={lookDir} onToggle={toggleLookDir} />
          </SlideReveal>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 h-full">
        {/* CARD 1: Profile Selection */}
        <div className="rounded-lg border border-[#2B4C6F] bg-[#102035]/80 p-4 flex flex-col">
          <div className="text-[10px] text-icy-blue/50 mb-4 uppercase">Profile Selection</div>
          <div className="flex flex-col gap-2 flex-1">
            {profiles.map(profile => {
              const isActive = activeProfile === profile;
              return (
                <button 
                  key={profile}
                  onClick={() => handleProfileChange(profile)}
                  className={`w-full text-left p-3 rounded border transition-all flex justify-between items-center ${
                    isActive 
                      ? 'border-[#E879F9]/70 bg-[#A21CAF]/25 text-white shadow-[0_0_18px_rgba(232,121,249,0.18)]' 
                      : 'border-[#2B4C6F]/50 text-icy-blue/60 hover:bg-icy-blue/5 hover:text-icy-blue'
                  }`}
                >
                  <span>[ {profile} ]</span>
                  {isActive && <span className="material-symbols-outlined text-sm">check</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* CARD 2: Kinematic Sliders */}
        <div className="rounded-lg border border-[#2B4C6F] bg-[#102035]/80 p-4 flex flex-col">
          <div className="text-[10px] text-icy-blue/50 mb-4 uppercase">Kinematic Calibration</div>
          <div className="flex flex-col gap-5 flex-1 justify-center">
            
            {/* Slider Component Helper */}
            {[
              { label: 'Ground Clearance', param: 'groundClearance', val: kinematicParams.groundClearance, min: 10, max: 40, unit: 'cm' },
              { label: 'Chassis Width', param: 'chassisWidth', val: kinematicParams.chassisWidth, min: 1.5, max: 2.8, unit: 'm', step: 0.1 },
              { label: 'Wheel Radius', param: 'wheelRadius', val: kinematicParams.wheelRadius, min: 25, max: 55, unit: 'cm' },
              { label: 'Curb Weight', param: 'curbWeight', val: kinematicParams.curbWeight, min: 1.0, max: 6.0, unit: 't', step: 0.1 },
            ].map(({ label, param, val, min, max, unit, step = 1 }) => (
              <div key={param} className="space-y-1 group">
                <div className="flex justify-between text-[10px] text-icy-blue/80">
                  <span>{label}</span>
                  <span className="tabular-nums">{val.toFixed(step < 1 ? 1 : 0)}{unit}</span>
                </div>
                <HudSlider
                  min={min}
                  max={max}
                  step={step}
                  value={val}
                  onChange={(v) => handleParamChange(param as keyof typeof kinematicParams, v)}
                />
              </div>
            ))}

          </div>
        </div>

        {/* CARD 3: System Telemetry */}
        <div className="rounded-lg border border-[#2B4C6F] bg-[#102035]/80 p-4 flex flex-col">
          <div className="text-[10px] text-icy-blue/50 mb-4 uppercase">System Telemetry</div>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="flex flex-col">
              <span className="text-[9px] text-icy-blue/40 uppercase">Map rate</span>
              <span className={`text-lg tabular-nums ${playing ? 'text-emerald-400' : 'text-icy-blue/70'}`}>
                {playing ? telemetry.mapHz.toFixed(1) : '—'} <span className="text-[10px] text-emerald-400/70">Hz</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-icy-blue/40 uppercase">Classifier</span>
              <span className="text-sm text-emerald-400">{telemetry.busStatus}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-icy-blue/40 uppercase">Input Stream</span>
              <span className="text-sm text-icy-blue truncate">{telemetry.inputStream}</span>
            </div>
          </div>
        </div>

        {/* CARD 4: Terrain Evaluation & Action */}
        <div className="rounded-lg border border-[#2B4C6F] bg-[#102035]/80 p-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="text-[10px] text-icy-blue/50 uppercase">Environmental Data</div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <SparkStat label="Friction" value={`${telemetry.friction.toFixed(2)}`} unit="mu" seed={telemetry.friction} />
              <SparkStat label="Incline" value={`${telemetry.incline.toFixed(1)}°`} unit="rad" seed={telemetry.incline} />
            </div>
          </div>
          <button 
            onClick={handleRecalibrate}
            className="w-full py-3 mt-4 border border-[#2B4C6F] text-icy-blue bg-[#060B14] hover:bg-fuchsia-500/10 hover:border-[#E879F9]/60 transition-all uppercase text-[10px] tracking-widest active:scale-[0.98]"
            style={
              calibrationState === "processing" ? { opacity: 0.5 } : 
              calibrationState === "complete" ? { borderColor: "#BCE3FF", color: "#fff" } : 
              {}
            }
          >
            {calibrationState === "idle" ? "[ RECALIBRATE_SYSTEM ]" : 
             calibrationState === "processing" ? "[ RECALIBRATING... ]" : 
             "[ CALIBRATION_COMPLETE ]"}
          </button>
        </div>
      </div>
            </section>
            {children}
      </ShiftLayer>
    </div>
  );
}

function ShiftLayer({
  open,
  z,
  children,
}: {
  open: boolean;
  z: number;
  children: ReactNode;
}) {
  return (
    <div
      className={open ? 'pointer-events-auto' : 'pointer-events-none'}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: z,
        transform: open ? 'translate3d(0,0,0)' : 'translate3d(0,110%,0)',
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

function SparkStat({ label, value, unit, seed }: { label: string; value: string; unit: string; seed: number }) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const n = Math.sin(seed * 8 + i * 0.85) * 0.35 + Math.sin(i * 1.7 + seed) * 0.2 + 0.5;
    const x = (i / 11) * 48;
    const y = 14 - n * 12;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] text-icy-blue/40 uppercase">{label}</span>
      <span className="text-lg text-icy-blue/90 tabular-nums">
        {value} <span className="text-[10px] text-icy-blue/50">{unit}</span>
      </span>
      <svg viewBox="0 0 48 16" className="w-full h-4" aria-hidden>
        <polyline fill="none" stroke="#67e8f9" strokeWidth="1.2" points={pts} />
      </svg>
    </div>
  );
}
