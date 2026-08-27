export function Header({
  lat,
  lng,
  streamLabel,
  live = false,
}: {
  terrainStatus: string;
  lat: number;
  lng: number;
  streamLabel?: string;
  live?: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-[#2B4C6F]/40 px-4 py-2 z-10 bg-[#060B14]/90 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-icy-blue/70">grid_on</span>
        <h1 className="text-xs font-bold tracking-[0.3em] text-icy-blue/80 uppercase">FOVEADRIVE</h1>
      </div>
      <div className="flex items-center gap-5 text-[10px] text-icy-blue/50 font-mono uppercase tracking-widest">
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.8)] ${live ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}`}></span>
          LINK_STATUS: <span className="text-emerald-400">{live ? 'PLAYBACK' : 'IDLE'}</span>
        </div>
        {streamLabel ? (
          <div className="tabular-nums text-icy-blue/70 normal-case tracking-wider">{streamLabel}</div>
        ) : (
          <div className="tabular-nums">
            {lat.toFixed(4)}° N, {Math.abs(lng).toFixed(4)}° W
          </div>
        )}
      </div>
    </header>
  );
}
