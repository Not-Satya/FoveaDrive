// frontend/src/components/FoveaDriveHUD.tsx

import { useRef } from "react";
import { Header }          from "./Header";
import { ViewportHUD }     from "./ViewportHUD";
import { ControlPanel }    from "./ControlPanel";
import { Footer }          from "./Footer";
import { CustomScrollbar } from "./CustomScrollbar";
import { useHUDState }     from "../hooks/useHUDState";

export function FoveaDriveHUD() {
  const hudState = useHUDState();
  const {
    terrainStatus,
    telemetry,
    mappingMode,
    toggleMappingMode,
    cells,
    mapLoading,
    speed,
  } = hudState;

  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="text-icy-blue selection:bg-white/20 text-xs bg-background h-screen w-screen overflow-hidden font-mono relative">

      {/* ── Fixed Background Viewport (the big dark map area) ─────────────── */}
      <div className="fixed inset-0 z-0 h-screen w-screen">
        <ViewportHUD
          terrainStatus={terrainStatus}
          speed={speed}
          mappingMode={mappingMode}
          toggleMappingMode={toggleMappingMode}
          cells={cells}
          loading={mapLoading}
          heading={359.7}
          elevation={telemetry.incline}
        />
      </div>

      {/* ── Scrollable overlay (header + control panel + footer) ──────────── */}
      <div
        ref={scrollRef}
        className="relative z-10 h-full flex flex-col overflow-y-auto scrollbar-hide"
      >
        <CustomScrollbar scrollContainerRef={scrollRef} />

        {/* Header */}
        <Header
          lat={telemetry.lat}
          lng={telemetry.lng}
          terrainStatus={terrainStatus}
        />

        {/* Spacer — lets the map show through */}
        <div className="flex-1 pointer-events-none" />

        {/* Control panel (pinned to bottom) */}
        <ControlPanel {...hudState} />

        <Footer />
      </div>

    </div>
  );
}
