// frontend/src/components/MapCanvas.tsx
//
// 3/4 isometric 2.5D occupancy grid — neon heat ramp, voxel gaps, radar ring.

import { useEffect, useRef } from 'react';
import type { GridCell } from '../api/foveadriveApi';

interface MapCanvasProps {
  cells: GridCell[];
  loading?: boolean;
  className?: string;
}

type Kind = 'clear' | 'rough' | 'nearby' | 'blocked' | 'pothole';
type RGB = [number, number, number];
type Pt = { x: number; y: number; d: number };

type Faces = {
  top: string;
  left: string;
  right: string;
  front: string;
  stroke: string;
  glow: string;
};

const WORLD_RANGE = 34;
const YAW = Math.PI / 5;
const COS = Math.cos(YAW);
const SIN = Math.sin(YAW);
const PITCH = 0.58;
const VOXEL_INSET = 0.10;

const GRADE = 0.08;       // nominal road surface (m)
const DEPTH_MAX = 0.75;   // deepest pothole in the colour scale (m)
const HEIGHT_MAX = 3.2;   // tallest obstacle in the colour scale (m)

const HEAT_STOPS: { t: number; rgb: RGB }[] = [
  { t: 0.00, rgb: [ 40, 200, 255] },
  { t: 0.18, rgb: [ 24, 120, 230] },
  { t: 0.36, rgb: [ 18,  64, 175] },
  { t: 0.50, rgb: [ 16,  40, 125] },
  { t: 0.64, rgb: [ 48,  42, 165] },
  { t: 0.80, rgb: [150,  32, 200] },
  { t: 1.00, rgb: [255,  80, 214] },
];

function kindOf(cell: GridCell): Kind {
  if (cell.reason === 'pothole' || cell.reason === 'pothole_ok' || cell.terrain === 'depression') {
    return 'pothole';
  }
  if (cell.reason === 'clear') return 'clear';
  if (cell.reason === 'rough_ok') return 'rough';
  if (cell.reason === 'obstacle_nearby') return 'nearby';
  if (cell.reason === 'obstacle' || cell.reason === 'too_rough' || cell.reason === 'height_exceeds_clearance') {
    return 'blocked';
  }
  if (cell.drivable) return cell.terrain === 'rough' ? 'rough' : 'clear';
  return 'blocked';
}

/** Map signed height to 0..1. 0 = deepest pothole, 0.5 = grade, 1 = tallest obstacle. */
function elevT(height: number): number {
  const s = height - GRADE;
  if (s <= 0) {
    const depth = Math.min((-s) / DEPTH_MAX, 1);
    return 0.5 * (1 - depth);
  }
  const rise = Math.min(s / HEIGHT_MAX, 1);
  return 0.5 + 0.5 * rise;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleHeat(t: number): RGB {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const b = HEAT_STOPS[i];
    if (x <= b.t) {
      const a = HEAT_STOPS[i - 1];
      const u = (x - a.t) / (b.t - a.t || 1);
      return [
        lerp(a.rgb[0], b.rgb[0], u),
        lerp(a.rgb[1], b.rgb[1], u),
        lerp(a.rgb[2], b.rgb[2], u),
      ];
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1].rgb;
}

function rgba(rgb: RGB, a: number) {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${Math.max(0, Math.min(1, a))})`;
}

function shade(rgb: RGB, k: number): RGB {
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function facesFor(t: number, fade: number): Faces {
  const rgb = sampleHeat(t);
  const a = (n: number) => n * fade;
  const glowMix = Math.max(0, (t - 0.78) / 0.22);
  const holeMix = Math.max(0, (0.22 - t) / 0.22);
  return {
    top:    rgba(rgb, a(0.58 + Math.abs(t - 0.5) * 0.7)),
    left:   rgba(shade(rgb, 0.42), a(0.70)),
    right:  rgba(shade(rgb, 0.22), a(0.78)),
    front:  rgba(shade(rgb, 0.32), a(0.74)),
    stroke: rgba(mix(rgb, [200, 230, 255], 0.2), a(0.18 + Math.abs(t - 0.5) * 0.5)),
    glow:   rgba(
      glowMix > holeMix ? mix(rgb, [255, 160, 230], glowMix) : mix(rgb, [80, 220, 255], holeMix),
      a(0.5 + Math.max(glowMix, holeMix) * 0.4),
    ),
  };
}

function slab(cell: GridCell, kind: Kind): { z0: number; z1: number } {
  if (kind === 'pothole' || cell.height < -0.04) {
    return { z0: Math.min(cell.height, -0.06), z1: 0 };
  }
  if (kind === 'blocked') {
    return { z0: 0, z1: Math.max(0.25, Math.min(cell.height * 1.05, 4.5)) };
  }
  if (kind === 'rough') {
    return { z0: 0, z1: 0.06 + Math.min(cell.height_std, 0.28) };
  }
  if (kind === 'nearby') {
    return { z0: 0, z1: 0.04 };
  }
  return { z0: 0, z1: Math.max(0.02, Math.min(Math.max(cell.height, 0), 0.12)) };
}

function fogFor(dist: number, t: number): number {
  const fog = Math.max(0.42, Math.min(1, 1.08 - dist / 55));
  const extreme = Math.abs(t - 0.5) > 0.28;
  return extreme ? Math.max(fog, 0.78) : fog;
}

function renderMap(canvas: HTMLCanvasElement, cells: GridCell[], loading: boolean) {
  const parent = canvas.parentElement;
  const cssW = parent?.clientWidth  || canvas.clientWidth  || 1;
  const cssH = parent?.clientHeight || canvas.clientHeight || 1;
  if (cssW < 8 || cssH < 8) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  if (canvas.width !== pxW)  canvas.width  = pxW;
  if (canvas.height !== pxH) canvas.height = pxH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const ox = cssW / 2;
  const oy = cssH * 0.58;
  const extent = WORLD_RANGE * (Math.abs(COS) + Math.abs(SIN));
  const scale = Math.min(cssW / (extent * 2.2), cssH / (extent * 2.2 * PITCH));
  const heightPx = scale * 1.35;

  const project = (x: number, y: number, z: number): Pt => {
    const rx = COS * y - SIN * x;
    const ry = SIN * y + COS * x;
    return {
      x: ox + rx * scale,
      y: oy - ry * scale * PITCH - z * heightPx,
      d: COS * x + SIN * y,
    };
  };

  const quad = (pts: Pt[], fill: string, stroke?: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  };

  const bg = ctx.createLinearGradient(0, 0, 0, cssH);
  bg.addColorStop(0, '#05080f');
  bg.addColorStop(0.45, '#070d18');
  bg.addColorStop(1, '#05080f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);

  const vignette = ctx.createRadialGradient(ox, oy, 30, ox, oy, Math.max(cssW, cssH) * 0.72);
  vignette.addColorStop(0, 'rgba(20,40,90,0.12)');
  vignette.addColorStop(1, 'rgba(5,8,15,0)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.save();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = 'rgba(43,76,111,0.22)';
  for (let v = -WORLD_RANGE; v <= WORLD_RANGE; v += 5) {
    const a = project(-WORLD_RANGE, v, 0);
    const b = project( WORLD_RANGE, v, 0);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const c = project(v, -WORLD_RANGE, 0);
    const d = project(v,  WORLD_RANGE, 0);
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  ctx.restore();

  const drawRing = (r: number, color: string, width: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const p = project(Math.cos(t) * r, Math.sin(t) * r, 0);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawRing(10, 'rgba(188,227,255,0.28)', 1);
  drawRing(30, 'rgba(188,227,255,0.18)', 1.2);

  const labelRing = (r: number, text: string, color: string) => {
    const p = project(r, 0, 0);
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x + 6, p.y);
    ctx.restore();
  };
  labelRing(10, '10 m', 'rgba(188,227,255,0.4)');
  labelRing(30, '30 m', 'rgba(188,227,255,0.28)');

  const visible = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => Math.abs(c.x) <= WORLD_RANGE + 2 && Math.abs(c.y) <= WORLD_RANGE + 2)
    .sort((a, b) => (COS * b.c.x + SIN * b.c.y) - (COS * a.c.x + SIN * a.c.y));

  let axisCell: GridCell | null = null;
  let axisH = 0;
  let holeCell: GridCell | null = null;
  let holeD = 0;

  for (const { c: cell } of visible) {
    const kind = kindOf(cell);
    const t = elevT(cell.height);
    const pal = facesFor(t, fogFor(Math.hypot(cell.x, cell.y), t));
    const { z0, z1 } = slab(cell, kind);
    const inset = cell.cell_size * VOXEL_INSET;
    const half = cell.cell_size / 2 - inset / 2;
    const x0 = cell.x - half;
    const x1 = cell.x + half;
    const y0 = cell.y - half;
    const y1 = cell.y + half;
    const p = (x: number, y: number, z: number) => project(x, y, z);

    if (kind === 'blocked' && z1 > axisH) {
      axisCell = cell;
      axisH = z1;
    }
    if (kind === 'pothole' && -z0 > holeD) {
      holeCell = cell;
      holeD = -z0;
    }

    if (Math.abs(z1 - z0) > 0.04) {
      quad([p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], pal.right);
      quad([p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], pal.left);
      quad([p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)], pal.right);
      quad([p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1)], pal.front);
    }

    const faceZ = kind === 'pothole' ? z0 : z1;
    quad(
      [p(x0, y0, faceZ), p(x1, y0, faceZ), p(x1, y1, faceZ), p(x0, y1, faceZ)],
      pal.top,
      pal.stroke,
    );

    if (t > 0.82 || t < 0.18) {
      ctx.save();
      ctx.shadowColor = pal.glow;
      ctx.shadowBlur = 10 + Math.abs(t - 0.5) * 28;
      quad(
        [p(x0, y0, faceZ), p(x1, y0, faceZ), p(x1, y1, faceZ), p(x0, y1, faceZ)],
        pal.top,
      );
      ctx.restore();
    }

    if (kind === 'nearby') {
      const v = [p(x0, y0, faceZ), p(x1, y0, faceZ), p(x1, y1, faceZ), p(x0, y1, faceZ)];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(v[0].x, v[0].y);
      v.slice(1).forEach((pt) => ctx.lineTo(pt.x, pt.y));
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = pal.stroke;
      ctx.lineWidth = 0.6;
      const minX = Math.min(...v.map((pt) => pt.x));
      const maxX = Math.max(...v.map((pt) => pt.x));
      const minY = Math.min(...v.map((pt) => pt.y));
      const maxY = Math.max(...v.map((pt) => pt.y));
      for (let s = minX - (maxY - minY); s < maxX + (maxY - minY); s += 5) {
        ctx.beginPath();
        ctx.moveTo(s, minY);
        ctx.lineTo(s + (maxY - minY), maxY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  const callout = (
    worldX: number,
    worldY: number,
    z: number,
    label: string,
    color: string,
  ) => {
    const p = project(worldX, worldY, z);
    const x2 = p.x + 22;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(x2, p.y);
    ctx.stroke();
    ctx.font = '10px "Space Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, x2 + 5, p.y);
    ctx.restore();
  };

  if (axisCell && axisH > 0.8) {
    callout(
      axisCell.x,
      axisCell.y + axisCell.cell_size * 0.7,
      axisH,
      `${axisH.toFixed(1)} m`,
      'rgba(188,227,255,0.7)',
    );
  }

  if (holeCell && holeD > 0.12) {
    callout(
      holeCell.x,
      holeCell.y - holeCell.cell_size * 0.7,
      -holeD,
      `−${holeD.toFixed(2)} m`,
      'rgba(80,200,255,0.75)',
    );
  }

  const vz = 0.35;
  const nose = project(1.15, 0, vz);
  const port = project(-0.55, -0.55, 0);
  const stbd = project(-0.55,  0.55, 0);
  const tail = project(-0.55,  0,    vz);

  ctx.save();
  ctx.shadowColor = 'rgba(188,227,255,0.7)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.lineTo(port.x, port.y);
  ctx.lineTo(tail.x, tail.y);
  ctx.lineTo(stbd.x, stbd.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(235,245,255,0.95)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(188,227,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  if (loading) {
    ctx.fillStyle = 'rgba(5,8,15,0.45)';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = 'rgba(188,227,255,0.7)';
    ctx.font = '11px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PROCESSING…', cssW / 2, cssH / 2);
    ctx.textAlign = 'left';
  }
}

export function MapCanvas({ cells, loading = false, className = '' }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef(cells);
  const loadingRef = useRef(loading);
  cellsRef.current = cells;
  loadingRef.current = loading;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => renderMap(canvas, cellsRef.current, loadingRef.current);
    const ro = new ResizeObserver(draw);
    ro.observe(canvas.parentElement ?? canvas);
    draw();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderMap(canvas, cells, loading);
  }, [cells, loading]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
