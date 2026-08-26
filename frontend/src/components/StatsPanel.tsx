// src/components/StatsPanel.tsx
//
// Status/stats panel for the dashboard sidebar.

import type { MapStats, VehicleProfile } from '../types/foveadrive';

interface Props {
  stats:   MapStats;
  vehicle: VehicleProfile;
}

const LEGEND = [
  { color: '#00c853', label: 'Drivable'               },
  { color: '#ffd600', label: 'Rough (passable)'        },
  { color: '#ff6d00', label: 'Obstacle in footprint'   },
  { color: '#d50000', label: 'Non-drivable'            },
];

export function StatsPanel({ stats, vehicle }: Props) {
  return (
    <div style={styles.panel}>

      {/* Vehicle info */}
      <div style={styles.section}>
        <h3 style={styles.heading}>Vehicle</h3>
        <p style={{ ...styles.value, color: vehicle.color }}>{vehicle.label}</p>
        <table style={styles.table}>
          <tbody>
            <tr><td style={styles.td}>Clearance</td><td style={styles.tdVal}>{vehicle.ground_clearance * 100} cm</td></tr>
            <tr><td style={styles.td}>Width</td>    <td style={styles.tdVal}>{vehicle.width} m</td></tr>
            <tr><td style={styles.td}>Wheel R</td>  <td style={styles.tdVal}>{vehicle.wheel_radius * 100} cm</td></tr>
          </tbody>
        </table>
      </div>

      {/* Drivability summary */}
      <div style={styles.section}>
        <h3 style={styles.heading}>Drivability</h3>
        <p style={{ ...styles.bigNum, color: '#00c853' }}>{stats.drivable_pct}%</p>
        <p style={styles.sub}>of {stats.total_cells} cells are drivable</p>

        {/* Progress bar */}
        <div style={styles.bar}>
          <div style={{ ...styles.barFill, width: `${stats.drivable_pct}%` }} />
        </div>
      </div>

      {/* Zone breakdown */}
      <div style={styles.section}>
        <h3 style={styles.heading}>By Zone</h3>
        {Object.entries(stats.zone_breakdown).map(([zone, z]) => (
          <div key={zone} style={styles.row}>
            <span style={styles.badge}>{zone}</span>
            <span style={styles.sub}>
              {z.drivable}/{z.total} ({Math.round(z.drivable / z.total * 100)}%)
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={styles.section}>
        <h3 style={styles.heading}>Legend</h3>
        {LEGEND.map(({ color, label }) => (
          <div key={label} style={styles.row}>
            <span style={{ ...styles.dot, background: color }} />
            <span style={styles.sub}>{label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel:   { background: '#1f2937', borderRadius: 10, padding: 16, color: '#f9fafb', width: 220, fontFamily: 'sans-serif' },
  section: { marginBottom: 20 },
  heading: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 8 },
  value:   { fontSize: 18, fontWeight: 700, margin: '4px 0' },
  bigNum:  { fontSize: 36, fontWeight: 800, margin: '4px 0', lineHeight: 1 },
  sub:     { fontSize: 12, color: '#9ca3af' },
  table:   { width: '100%', borderCollapse: 'collapse' },
  td:      { fontSize: 12, color: '#9ca3af', paddingRight: 8, paddingBottom: 4 },
  tdVal:   { fontSize: 12, color: '#f9fafb', fontWeight: 600, paddingBottom: 4 },
  bar:     { height: 8, background: '#374151', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  barFill: { height: '100%', background: '#00c853', borderRadius: 4, transition: 'width 0.4s ease' },
  row:     { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge:   { fontSize: 10, background: '#374151', padding: '2px 6px', borderRadius: 4, color: '#d1d5db', textTransform: 'capitalize' },
  dot:     { width: 10, height: 10, borderRadius: 2, flexShrink: 0 },
};
