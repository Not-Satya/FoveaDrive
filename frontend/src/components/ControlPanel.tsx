import { useState } from "react";
import { useHUDState } from "../hooks/useHUDState";
import { VehicleProfile } from "../types";

export function ControlPanel(props: ReturnType<typeof useHUDState>) {
  const { activeProfile, kinematicParams, telemetry, handleProfileChange, handleParamChange } = props;
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
    <section className="bg-[#060B14]/80 backdrop-blur-md p-4 rounded-xl border border-[#2B4C6F]/30 shadow-2xl">
      <div className="grid grid-cols-4 gap-4 h-full">
        {/* CARD 1: Profile Selection */}
        <div className="icy-glass rounded-lg p-4 flex flex-col">
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
                      ? 'border-[#2B4C6F] bg-icy-blue/10 text-white' 
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
        <div className="icy-glass rounded-lg p-4 flex flex-col">
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
                <div className="relative flex items-center h-2">
                  <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    step={step}
                    value={val}
                    onChange={(e) => handleParamChange(param as keyof typeof kinematicParams, parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-1 bg-[#2B4C6F] appearance-none rounded-full outline-none z-10 opacity-0 cursor-pointer"
                  />
                  {/* Visual Background */}
                  <div className="absolute inset-x-0 h-1 bg-[#2B4C6F]" />
                  {/* Visual fill element */}
                  <div 
                    className="absolute left-0 h-1 bg-icy-blue pointer-events-none transition-all duration-500 ease-out" 
                    style={{ width: `${((val - min) / (max - min)) * 100}%` }}
                  />
                  {/* Custom Thumb */}
                  <div 
                    className="absolute size-[9px] bg-white rounded-sm shadow-[0_0_8px_rgba(188,227,255,0.8)] pointer-events-none -translate-x-1/2 transition-all duration-500 ease-out group-hover:scale-125"
                    style={{ left: `${((val - min) / (max - min)) * 100}%` }}
                  />
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* CARD 3: System Telemetry */}
        <div className="icy-glass rounded-lg p-4 flex flex-col">
          <div className="text-[10px] text-icy-blue/50 mb-4 uppercase">System Telemetry</div>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="flex flex-col">
              <span className="text-[9px] text-icy-blue/40 uppercase">FPS Rate</span>
              <span className="text-lg text-white tabular-nums">{telemetry.fpsRate.toFixed(1)} <span className="text-[10px] text-icy-blue/60">Hz</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-icy-blue/40 uppercase">Hardware Bus Status</span>
              <span className="text-sm text-icy-blue">{telemetry.busStatus}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-icy-blue/40 uppercase">Input Stream</span>
              <span className="text-sm text-icy-blue truncate">{telemetry.inputStream}</span>
            </div>
          </div>
        </div>

        {/* CARD 4: Terrain Evaluation & Action */}
        <div className="icy-glass rounded-lg p-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="text-[10px] text-icy-blue/50 uppercase">Environmental Data</div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex flex-col">
                <span className="text-[9px] text-icy-blue/40 uppercase">Friction</span>
                <span className="text-lg text-icy-blue/90 tabular-nums">{telemetry.friction.toFixed(2)} <span className="text-[10px] text-icy-blue/50">mu</span></span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-icy-blue/40 uppercase">Incline</span>
                <span className="text-lg text-icy-blue/90 tabular-nums">{telemetry.incline.toFixed(1)}° <span className="text-[10px] text-icy-blue/50">rad</span></span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleRecalibrate}
            className="w-full py-3 mt-4 border border-[#2B4C6F] text-icy-blue bg-[#060B14] hover:bg-icy-blue/10 transition-all uppercase text-[10px] tracking-widest active:scale-[0.98]"
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
  );
}
