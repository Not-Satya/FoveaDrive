// frontend/src/components/FoveaDriveHUD.tsx

import { useRef, useState } from "react";
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

  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="text-icy-blue selection:bg-white/20 text-xs bg-background h-screen w-screen overflow-hidden font-mono relative">

      <div className="fixed inset-0 z-0 h-screen w-screen">
        <ViewportHUD
          terrainStatus={terrainStatus}
          speed={speed}
          mappingMode={mappingMode}
          toggleMappingMode={toggleMappingMode}
          cells={cells}
          loading={mapLoading && !hudState.playing}
          playing={hudState.playing}
          heading={359.7}
          elevation={telemetry.incline}
        />
      </div>

      {/* pointer-events-none so drag-orbit on the map works through the chrome */}
      <div
        ref={scrollRef}
        className="relative z-10 h-full flex flex-col overflow-y-auto scrollbar-hide pointer-events-none"
      >
        <CustomScrollbar scrollContainerRef={scrollRef} />

        <div className="pointer-events-auto">
          <Header
            lat={telemetry.lat}
            lng={telemetry.lng}
            terrainStatus={terrainStatus}
            streamLabel={hudState.telemetry.inputStream}
            live={hudState.playing}
          />
        </div>

        <div className="flex-1" />

        <div className="pointer-events-auto">
          <ControlPanel
            {...hudState}
            collapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed(v => !v)}
          />
          {!panelCollapsed && <Footer />}
        </div>
      </div>

    </div>
  );
}
