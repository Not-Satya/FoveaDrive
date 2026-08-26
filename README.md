# FoveaDrive | Adaptive 2.5D Mapping System

This directory contains the Python FastAPI backend for FoveaDrive. It powers the foveated grid generation and the vehicle-aware drivability engine.

## 🚀 Quick Start Guide

To run the full FoveaDrive stack, you need to start both the Python backend and the React frontend.

### 1. Start the Backend Server
Open a terminal inside this `backend` directory and run:

```bash
# Install the required Python packages
pip install -r requirements.txt

# Start the FastAPI server on port 8000
python -m uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload
```
*Note: The API will be running at `http://localhost:8000`. You can view the interactive API documentation at `http://localhost:8000/docs`.*

### 2. Start the Frontend UI
Open a **second** terminal window, navigate to your `frontend` directory, and run:

```bash
# Navigate to the frontend folder (adjust path if needed)
cd ../frontend

# Install Node modules (only needed the first time)
npm install

# Start the Vite development server
npm run dev
```
*The UI will be available at `http://localhost:5173`. Open this URL in your web browser.*

---

## 🧠 Core Architecture

Our backend doesn't just map terrain—it actively evaluates whether *your specific vehicle* can survive driving over it.

* **Foveated Grid (`processing/grid.py`):** Processes LiDAR/Ultrasonic point clouds adaptively. It uses high resolution (0.5m) near the vehicle for precision, and low resolution (2.0m) far away to save edge-compute resources.
* **Terrain Classifier (`processing/terrain.py`):** Analyzes the height variation (standard deviation) of points to classify raw data as `ground`, `rough`, or `obstacle`.
* **Drivability Engine (`processing/drivability.py`):** Cross-references the terrain map with the active vehicle's kinematic profile (Ground Clearance, Chassis Width, Wheel Radius). It calculates footprint dangers and flags cells as Safe (Green), Rough (Yellow), Width Danger (Orange), or Fatal Obstacle (Red).

## 🔗 Key API Endpoints
* `GET /map?vehicle=sedan` - Fetches the map using a preset vehicle profile (sedan, suv, truck).
* `GET /map/custom` - Driven live by the UI sliders. Dynamically recalculates drivability based on custom clearance, width, and radius.
