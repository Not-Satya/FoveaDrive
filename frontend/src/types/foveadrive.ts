// src/types/foveadrive.ts

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export type VehicleType = 'sedan' | 'suv' | 'truck';

export interface VehicleProfile {
  id:               VehicleType;
  label:            string;
  ground_clearance: number;   // metres
  wheel_radius:     number;   // metres
  width:            number;   // metres
  max_roughness:    number;   // metres (height std tolerance)
  color:            string;   // hex colour for UI accents
}

export type VehiclesResponse = Record<VehicleType, VehicleProfile>;

// ─── Grid cell ────────────────────────────────────────────────────────────────

export type Zone    = 'near' | 'mid' | 'far';
export type Terrain = 'ground' | 'rough' | 'obstacle' | 'depression';

/**
 * Reason codes returned by the drivability engine.
 * Useful for tooltips / legend.
 */
export type DrivabilityReason =
  | 'clear'                      // fully drivable ground
  | 'rough_ok'                   // rough but within vehicle tolerance
  | 'obstacle'                   // cell itself is an obstacle
  | 'obstacle_nearby'            // obstacle within vehicle width/2 footprint
  | 'too_rough'                  // roughness exceeds vehicle limit
  | 'height_exceeds_clearance'  // ground step too high for vehicle
  | 'pothole'                    // below-grade hole deeper than wheel radius allows
  | 'pothole_ok';                // shallow dip, still drivable

export interface GridCell {
  x:           number;   // cell centre X (metres, forward)
  y:           number;   // cell centre Y (metres, lateral)
  zone:        Zone;
  cell_size:   number;   // metres
  height:      number;   // mean Z of points in cell
  height_std:  number;   // roughness indicator
  point_count: number;
  terrain:     Terrain;
  drivable:    boolean;
  reason:      DrivabilityReason;
  color:       string;   // icy HUD hex; canvas remaps by `reason`
  semantic?:      number;
  semantic_name?: string;
  obstacle_frac?: number;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface ZoneStat {
  total:    number;
  drivable: number;
}

export interface MapStats {
  vehicle:            VehicleType;
  total_cells:        number;
  drivable:           number;
  non_drivable:       number;
  drivable_pct:       number;
  zone_breakdown:     Record<Zone, ZoneStat>;
  terrain_breakdown:  Record<Terrain, number>;
  reason_breakdown:   Record<DrivabilityReason, number>;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status:    'ok';
  message:   string;
  timestamp: number;
}

// ─── Custom (slider) response ─────────────────────────────────────────────────

export interface CustomVehicleParams {
  ground_clearance: number;
  width:            number;
  wheel_radius:     number;
  max_roughness:    number;
}

export interface CustomMapResponse {
  params: CustomVehicleParams;
  stats:  MapStats;
  cells:  GridCell[];
}

