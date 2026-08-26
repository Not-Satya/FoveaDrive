export type VehicleProfile = 'SEDAN' | 'SUV' | 'TRUCK';

export interface KinematicParams {
  groundClearance: number;
  chassisWidth: number;
  wheelRadius: number;
  curbWeight: number;
}

export interface TelemetryData {
  fpsRate: number;
  busStatus: string;
  inputStream: string;
  friction: number;
  incline: number;
  speed: number;
  lat: number;
  lng: number;
}

export type MappingMode = 'RAW_POINT_CLOUD' | 'HEATMAP';
