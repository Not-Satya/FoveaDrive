// frontend/src/types.ts

export type VehicleProfile = 'SEDAN' | 'SUV' | 'TRUCK';

export type MappingMode = 'RAW_POINT_CLOUD' | 'DRIVABILITY_MAP';

export type ScanMode = 'surround' | 'windshield';

export type LookDir = 'front' | 'rear';

export interface KinematicParams {
  groundClearance: number;  // cm
  chassisWidth:    number;  // metres
  wheelRadius:     number;  // cm
  curbWeight:      number;  // tonnes
}

export interface TelemetryData {
  fpsRate:     number;
  mapHz:       number;
  busStatus:   string;
  inputStream: string;
  lat:         number;
  lng:         number;
  friction:    number;
  incline:     number;
}
