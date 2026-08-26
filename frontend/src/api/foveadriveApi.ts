// frontend/src/api/foveadriveApi.ts

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface GridCell {
  x: number; y: number;
  zone: 'near' | 'mid' | 'far';
  cell_size: number;
  height: number; height_std: number; point_count: number;
  terrain: 'ground' | 'rough' | 'obstacle' | 'depression';
  drivable: boolean;
  reason: string;
  color: string; // hex ready to paint
}

export interface MapStats {
  drivable_pct: number;
  total_cells: number;
  drivable: number;
  non_drivable: number;
}

export interface CustomMapResponse {
  params: { ground_clearance: number; width: number; wheel_radius: number; max_roughness: number };
  stats: MapStats;
  cells: GridCell[];
}

// Preset vehicle (sedan / suv / truck — lowercase)
export const fetchMap = (vehicle: string): Promise<GridCell[]> =>
  get<GridCell[]>(`/map?vehicle=${vehicle.toLowerCase()}`);

export const fetchMapStats = (vehicle: string): Promise<MapStats> =>
  get<MapStats>(`/map/stats?vehicle=${vehicle.toLowerCase()}`);

// Slider-driven custom params (one call returns both cells + stats)
export const fetchCustomMap = (p: {
  ground_clearance: number; // metres
  width: number;            // metres
  wheel_radius: number;     // metres
}): Promise<CustomMapResponse> => {
  const q = new URLSearchParams({
    ground_clearance: String(p.ground_clearance),
    width:            String(p.width),
    wheel_radius:     String(p.wheel_radius),
  });
  return get<CustomMapResponse>(`/map/custom?${q}`);
};
