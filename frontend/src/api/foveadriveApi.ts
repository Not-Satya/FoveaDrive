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
  color: string;
  semantic?: number;
  semantic_name?: string;
  obstacle_frac?: number;
}

export interface LidarFrame {
  id: string;
  sequence: string | null;
  source_frame: string | null;
  category: string;
  population: string;
  difficulty: number;
  special: boolean;
}

export interface DatasetCurrent {
  source: 'kitti' | 'synthetic';
  frame_id: string | null;
  point_count: number | null;
  labeled?: boolean;
  sequence?: string | null;
  category?: string;
  difficulty?: number;
  special?: boolean;
}

export interface DatasetResponse {
  name: string;
  version: string;
  current: DatasetCurrent;
  frames: LidarFrame[];
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

export const fetchDataset = (): Promise<DatasetResponse> =>
  get<DatasetResponse>('/dataset');

export const fetchMap = (vehicle: string, frame?: string, scan?: string, look?: string): Promise<GridCell[]> => {
  const q = new URLSearchParams({ vehicle: vehicle.toLowerCase() });
  if (frame) q.set('frame', frame);
  if (scan) q.set('scan', scan);
  if (look) q.set('look', look);
  return get<GridCell[]>(`/map?${q}`);
};

export const fetchMapStats = (vehicle: string, frame?: string, scan?: string, look?: string): Promise<MapStats> => {
  const q = new URLSearchParams({ vehicle: vehicle.toLowerCase() });
  if (frame) q.set('frame', frame);
  if (scan) q.set('scan', scan);
  if (look) q.set('look', look);
  return get<MapStats>(`/map/stats?${q}`);
};

export const fetchCustomMap = (p: {
  ground_clearance: number;
  width: number;
  wheel_radius: number;
  frame?: string;
  scan?: string;
  look?: string;
}): Promise<CustomMapResponse> => {
  const q = new URLSearchParams({
    ground_clearance: String(p.ground_clearance),
    width:            String(p.width),
    wheel_radius:     String(p.wheel_radius),
  });
  if (p.frame) q.set('frame', p.frame);
  if (p.scan) q.set('scan', p.scan);
  if (p.look) q.set('look', p.look);
  return get<CustomMapResponse>(`/map/custom?${q}`);
};
