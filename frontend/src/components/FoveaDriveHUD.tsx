// frontend/src/components/FoveaDriveHUD.tsx

import { useState } from "react";
import { Header }          from "./Header";
import { ViewportHUD }     from "./ViewportHUD";
import { ControlPanel }    from "./ControlPanel";
import { Footer }          from "./Footer";
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

  return (
    <div className="text-icy-blue selection:bg-white/20 text-xs bg-background h-screen w-screen overflow-hidden font-mono relative">

      <div className="fixed inset-0 z-0 h-screen w-screen">
        <ViewportHUD
          terrainStatus={terrainStatus}
          speed={speed}
          mappingMode={mappingMode}
          toggleMappingMode={toggleMappingMode}
          scanMode={hudState.scanMode}
          toggleScanMode={hudState.toggleScanMode}
          lookDir={hudState.lookDir}
          toggleLookDir={hudState.toggleLookDir}
          cells={cells}
          loading={mapLoading && !hudState.playing}
          playing={hudState.playing}
          heading={359.7}
          elevation={telemetry.incline}
        />
      </div>

      <div className="relative z-10 h-full flex flex-col pointer-events-none">
        <div className="pointer-events-auto">
          <Header
            lat={telemetry.lat}
            lng={telemetry.lng}
            terrainStatus={terrainStatus}
            streamLabel={hudState.telemetry.inputStream}
            live={hudState.playing}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none px-3 pb-3">
        <ControlPanel
          {...hudState}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed(v => !v)}
        >
          <Footer />
        </ControlPanel>
      </div>

    </div>
  );
}
