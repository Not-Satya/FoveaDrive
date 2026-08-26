import { useState, useMemo, useEffect } from 'react';
import { VehicleProfile, KinematicParams, TelemetryData, MappingMode } from '../types';

const PROFILES: Record<VehicleProfile, KinematicParams> = {
  SEDAN: {
    groundClearance: 15,
    chassisWidth: 1.8,
    wheelRadius: 32,
    curbWeight: 1.5,
  },
  SUV: {
    groundClearance: 22,
    chassisWidth: 2.0,
    wheelRadius: 38,
    curbWeight: 2.2,
  },
  TRUCK: {
    groundClearance: 32,
    chassisWidth: 2.4,
    wheelRadius: 45,
    curbWeight: 3.5,
  }
};

export function useHUDState() {
  const [activeProfile, setActiveProfile] = useState<VehicleProfile>('SEDAN');
  const [kinematicParams, setKinematicParams] = useState<KinematicParams>(PROFILES.SEDAN);
  const [mappingMode, setMappingMode] = useState<MappingMode>('RAW_POINT_CLOUD');

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    fpsRate: 59.8,
    busStatus: 'Ultrasonic Scanner Active',
    inputStream: 'Simulated LiDAR Point Cloud',
    friction: 0.82,
    incline: 2.4,
    speed: 45.2,
    lat: 45.4215,
    lng: -75.6972,
  });

  const handleProfileChange = (profile: VehicleProfile) => {
    setActiveProfile(profile);
    setKinematicParams(PROFILES[profile]);
  };

  const handleParamChange = (param: keyof KinematicParams, value: number) => {
    setKinematicParams(prev => ({ ...prev, [param]: value }));
  };

  const toggleMappingMode = () => {
    setMappingMode(prev => prev === 'RAW_POINT_CLOUD' ? 'HEATMAP' : 'RAW_POINT_CLOUD');
  };

  const terrainStatus = useMemo(() => {
    if (kinematicParams.groundClearance < 20) {
      return 'HAZARDOUS / UNTRAVERSABLE';
    }
    return 'SAFE / DRIVABLE';
  }, [kinematicParams]);

  // Live telemetry simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        fpsRate: 58 + Math.random() * 2, // 58 to 60
        speed: 42 + Math.random() * 6, // 42 to 48
        lat: prev.lat + (Math.random() - 0.5) * 0.00001,
        lng: prev.lng + (Math.random() - 0.5) * 0.00001,
      }));
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return {
    activeProfile,
    kinematicParams,
    terrainStatus,
    telemetry,
    mappingMode,
    handleProfileChange,
    handleParamChange,
    toggleMappingMode,
  };
}
