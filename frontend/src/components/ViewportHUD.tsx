import { MappingMode } from '../types';

interface ViewportHUDProps {
  terrainStatus: string;
  speed: number;
  mappingMode: MappingMode;
  toggleMappingMode: () => void;
}

export function ViewportHUD({ terrainStatus, speed, mappingMode, toggleMappingMode }: ViewportHUDProps) {
  const isHazardous = terrainStatus === 'HAZARDOUS / UNTRAVERSABLE';

  return (
    <section className={`h-full w-full relative overflow-hidden flex flex-col bg-[#05080f] transition-all duration-1000 ${
      isHazardous ? 'shadow-[inset_0_0_200px_rgba(239,68,68,0.12)]' : ''
    }`}>
      
      {/* Left-side HUD column — speed + terrain */}
      <div className="absolute left-0 top-8 px-4 py-2 flex flex-col gap-3 z-20 pointer-events-none">
        <div className="text-[10px] font-mono tracking-widest text-icy-blue/60 uppercase tabular-nums">
          SYSTEM_SPEED: <span className="text-icy-blue/90">{speed.toFixed(1)} km/h</span>
        </div>
        {/* Terrain boxed badge */}
        <div className={`text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 border backdrop-blur-sm transition-all duration-700 w-fit ${
          isHazardous
            ? 'border-red-500/60 bg-red-900/20 text-red-400'
            : 'border-[#2B4C6F]/70 bg-[#060B14]/50 text-icy-blue/80'
        }`}>
          TERRAIN: {terrainStatus}
        </div>
      </div>


      {/* 2.5D Terrain Visualizer */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Orbital Rings */}
        <div className={`absolute inset-0 flex items-center justify-center opacity-10 transition-colors duration-1000 ${isHazardous ? 'text-red-500' : 'text-[#93C5FD]'}`}>
          <div className="border border-current size-[800px] rounded-full scale-y-[0.3]"></div>
          <div className="absolute border border-current size-[1200px] rounded-full scale-y-[0.3] opacity-50"></div>
          <div className="absolute border border-current size-[1600px] rounded-full scale-y-[0.3] opacity-20"></div>
        </div>
        
        {/* Perspective Grid */}
        <div className="relative w-full h-full flex items-center justify-center">
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-1000" 
            style={{ 
              backgroundImage: mappingMode === 'HEATMAP' 
                ? `linear-gradient(${isHazardous ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'} 1px, transparent 1px), linear-gradient(90deg, ${isHazardous ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'} 1px, transparent 1px)`
                : `linear-gradient(${isHazardous ? 'rgba(239,68,68,0.08)' : 'rgba(147,197,253,0.08)'} 1px, transparent 1px), linear-gradient(90deg, ${isHazardous ? 'rgba(239,68,68,0.08)' : 'rgba(147,197,253,0.08)'} 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
              transform: 'perspective(1000px) rotateX(65deg) translateY(-20%) scale(2)'
            }}
          />
          {/* Scanline */}
          <div className="scanline z-10"></div>
        </div>
        
        {/* Vehicle Proxy */}
        <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className={`size-8 border-2 rotate-45 flex items-center justify-center transition-colors duration-1000 ${isHazardous ? 'border-red-500' : 'border-icy-blue'}`}>
            <div className={`size-2 animate-pulse ${isHazardous ? 'bg-red-400' : 'bg-white'}`}></div>
          </div>
          <div className={`h-32 w-[1px] bg-gradient-to-t to-transparent transition-colors duration-1000 ${isHazardous ? 'from-red-500/40' : 'from-icy-blue/40'}`}></div>
        </div>
      </div>
    </section>
  );
}
