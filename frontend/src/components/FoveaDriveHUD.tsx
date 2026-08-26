import { useRef } from "react";
import { Header } from "./Header";
import { ViewportHUD } from "./ViewportHUD";
import { ControlPanel } from "./ControlPanel";
import { Footer } from "./Footer";
import { CustomScrollbar } from "./CustomScrollbar";
import { useHUDState } from "../hooks/useHUDState";

export function FoveaDriveHUD() {
  const hudState = useHUDState();
  const { terrainStatus, telemetry, mappingMode, toggleMappingMode } = hudState;
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="text-icy-blue selection:bg-white/20 text-xs bg-background h-screen w-screen overflow-hidden font-mono relative">
      {/* Fixed Background Viewport */}
      <div className="fixed inset-0 z-0 h-screen w-screen pointer-events-none">
        <ViewportHUD
          terrainStatus={terrainStatus}
          speed={telemetry.speed}
          mappingMode={mappingMode}
          toggleMappingMode={toggleMappingMode}
        />
      </div>

      {/* Scrollable Overlay Layer */}
      <div
        ref={scrollRef}
        className="relative z-10 w-full h-full flex flex-col overflow-y-auto no-scrollbar"
      >
        <div className="sticky top-0 z-50 pointer-events-auto">
          <Header terrainStatus={terrainStatus} lat={telemetry.lat} lng={telemetry.lng} />
        </div>

        {/* Spacer: pushes control panels below the fold */}
        <div className="h-[calc(100vh-32px)] shrink-0 pointer-events-none" />

        {/* Control Panels */}
        <main className="flex-1 w-full px-4 pb-6 pointer-events-auto">
          <ControlPanel {...hudState} />
        </main>

        <div className="pointer-events-auto">
          <Footer />
        </div>
      </div>

      {/* Custom HUD Scrollbar */}
      <CustomScrollbar scrollContainerRef={scrollRef} />
    </div>
  );
}
