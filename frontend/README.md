# FoveaDrive — Front-End HUD Interface

A high-performance, responsive 2.5D Head-Up Display (HUD) and dynamic telemetry control panel built for **FoveaDrive**. The front-end renders dynamic LiDAR point-cloud visuals, real-time vehicle kinematics, and terrain drivability metrics through an intuitive cyber-HUD dashboard.

<p align="center">
  <img src="./public/Screenshot%202026-08-26%20115945.png" alt="FoveaDrive HUD Interface Preview" width="100%" />
</p>

**Developer:** [arhennia](https://github.com/arhennia)

---

## Key Features

* **Dynamic HUD Viewport:** Overlay system telemetry, speed metrics, coordinate streaming, and raw point-cloud visualizers directly over the 3D viewport.
* **Kinematic Calibration Controls:** Draggable interactive controls for parameters like Ground Clearance, Chassis Width, Wheel Radius, and Curb Weight.
* **Automated Preset Sync:** Quick-select vehicle profiles (`SEDAN`, `SUV`, `TRUCK`) that automatically update active parameters.
* **Live Drivability Safety Engine:** Real-time terrain safety evaluations (`SAFE / DRIVABLE` vs. `HAZARDOUS / UNTRAVERSABLE`) based on physical clearance thresholds.
* **Glassmorphism Aesthetic:** Cyberpunk-inspired dark-theme layout using custom scrollbars and subtle backdrop blurs.

---

## Tech Stack

* **Framework:** React 19 + Vite
* **Language:** TypeScript (`.tsx`)
* **Styling:** Tailwind CSS
* **Linter/Tooling:** Oxlint & SWC (`@vitejs/plugin-react-swc`)

---

## Project Structure

```text
frontend/
├── public/
│   └── Screenshot 2026-08-26 115945.png
├── src/
│   ├── components/
│   │   ├── FoveaDriveHUD.tsx     # Main container component
│   │   ├── ViewportHUD.tsx       # Top 3D viewport & live overlay
│   │   ├── ControlPanel.tsx      # Interactive sliders & presets
│   │   ├── Header.tsx            # Compact navigation bar
│   │   └── Footer.tsx            # Status footers & system links
│   ├── hooks/
│   │   └── useHUDState.ts        # Custom React state management hook
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── App.tsx                   # Root entry component
│   └── index.css                 # Global CSS & Tailwind imports
├── package.json
├── tailwind.config.js
└── vite.config.js