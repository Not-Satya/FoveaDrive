# FoveaDrive — Front-End HUD Interface

A high-performance, responsive 2.5D Head-Up Display (HUD) and dynamic telemetry control panel built for **FoveaDrive**. The front-end renders dynamic LiDAR point-cloud visuals, real-time vehicle kinematics, and terrain drivability metrics through an intuitive cyber-HUD dashboard.

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

```

---

## Getting Started

### Prerequisites

Make sure you have Node.js (v18+) installed.

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend

```


2. Install dependencies:
```bash
npm install

```


3. Start the Vite development server:
```bash
npm run dev

```


4. Open `http://localhost:5173` in your browser.

---

## Available Scripts

* `npm run dev` — Starts the development server with HMR.
* `npm run build` — Compiles production-ready TypeScript assets to the `dist` folder.
* `npm run lint` — Runs Oxlint checks across the codebase.
* `npm run preview` — Previews the production build locally.