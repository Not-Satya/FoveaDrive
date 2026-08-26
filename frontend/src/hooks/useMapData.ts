// src/hooks/useMapData.ts
//
// Custom React hook that wraps fetchMap + fetchMapStats with loading/error state.
// Drop this in any component to get live map data on vehicle change.

import { useState, useEffect, useCallback } from 'react';
import { fetchMap, fetchMapStats } from '../api/foveadriveApi';
import type { GridCell, MapStats, VehicleType } from '../types/foveadrive';

interface UseMapDataResult {
  cells:     GridCell[];
  stats:     MapStats | null;
  loading:   boolean;
  error:     string | null;
  refresh:   () => void;
}

export function useMapData(vehicle: VehicleType): UseMapDataResult {
  const [cells,   setCells]   = useState<GridCell[]>([]);
  const [stats,   setStats]   = useState<MapStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch map + stats in parallel
      const [mapData, statsData] = await Promise.all([
        fetchMap(vehicle),
        fetchMapStats(vehicle),
      ]);
      setCells(mapData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [vehicle]);

  useEffect(() => { load(); }, [load]);

  return { cells, stats, loading, error, refresh: load };
}
