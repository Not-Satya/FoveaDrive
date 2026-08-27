// frontend/src/components/MapCanvas.tsx
//
// 3/4 isometric 2.5D occupancy grid — neon heat ramp, voxel gaps, radar ring.

import { useEffect, useRef, type PointerEvent } from 'react';
import type { GridCell } from '../api/foveadriveApi';
import type { MappingMode, ScanMode, LookDir } from '../types';

interface MapCanvasProps {
  cells: GridCell[];
  loading?: boolean;
  mappingMode?: MappingMode;
  scanMode?: ScanMode;
  lookDir?: LookDir;
  className?: string;
  onViewChange?: (yaw: number, pitch: number) => void;
}

const WORLD_RANGE = 42;
const WINDSHIELD_RANGE = 36;
const WINDSHIELD_FOV = Math.PI * (120 / 180); // 120°
const WINDSHIELD_YAW_MAX = 0.42;
const DEFAULT_YAW = Math.PI / 5;
const DEFAULT_PITCH = 0.58;
const DEFAULT_ZOOM = 1;
const WINDSHIELD_YAW = 0;
const REAR_YAW = Math.PI;
const WINDSHIELD_PITCH = 0.80;
const WINDSHIELD_ZOOM = 1.2;
const PITCH_MIN = 0.22;
const PITCH_MAX = 0.92;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 5;
const VOXEL_INSET = 0.10;

function camDefaults(mode: ScanMode, look: LookDir = 'front') {
  if (mode === 'windshield') {
    return {
      yaw: look === 'rear' ? REAR_YAW : WINDSHIELD_YAW,
      pitch: WINDSHIELD_PITCH,
      zoom: WINDSHIELD_ZOOM,
    };
  }
  return { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: DEFAULT_ZOOM };
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

const SEMANTIC_RGB: Record<string, RGB> = {
  road: [20, 50, 130],
  'lane-marking': [48, 88, 175],
  parking: [28, 62, 120],
  sidewalk: [70, 100, 150],
  'other-ground': [44, 78, 118],
  terrain: [24, 110, 120],
  car: [255, 80, 214],
  'moving-car': [255, 80, 214],
  truck: [232, 90, 160],
  'moving-truck': [232, 90, 160],
  bus: [220, 70, 140],
  'moving-bus': [220, 70, 140],
  'other-vehicle': [240, 100, 180],
  'moving-other-vehicle': [240, 100, 180],
  bicycle: [120, 200, 255],
  motorcycle: [100, 180, 255],
  person: [80, 220, 255],
  'moving-person': [80, 220, 255],
  bicyclist: [100, 210, 255],
  motorcyclist: [90, 190, 255],
  building: [96, 42, 165],
  fence: [140, 80, 190],
  'other-structure': [110, 60, 170],
  vegetation: [20, 150, 155],
  trunk: [36, 100, 90],
  pole: [190, 170, 230],
  'traffic-sign': [255, 180, 80],
  'other-object': [170, 90, 150],
  unlabeled: [50, 70, 105],
  outlier: [40, 50, 70],
};

function facesFromRgb(rgb: RGB, fade: number, glowMix = 0): Faces {
  const a = (n: number) => n * fade;
  return {
    top:    rgba(rgb, a(0.72)),
    left:   rgba(shade(rgb, 0.42), a(0.70)),
    right:  rgba(shade(rgb, 0.22), a(0.78)),
    front:  rgba(shade(rgb, 0.32), a(0.74)),
    stroke: rgba(mix(rgb, [200, 230, 255], 0.2), a(0.28)),
    glow:   rgba(mix(rgb, [255, 180, 240], glowMix), a(0.45 + glowMix * 0.4)),
  };
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
  if (kind === 'pothole') {
    return { z0: Math.max(Math.min(cell.height, -0.06), -1.2), z1: 0 };
  }
  if (kind === 'blocked') {
    return { z0: 0, z1: Math.max(0.25, Math.min(Math.max(cell.height, 0.3) * 1.05, 4.5)) };
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

function renderMap(
  canvas: HTMLCanvasElement,
  cells: GridCell[],
  loading: boolean,
  mappingMode: MappingMode = 'DRIVABILITY_MAP',
  yaw = DEFAULT_YAW,
  pitch = DEFAULT_PITCH,
  zoom = DEFAULT_ZOOM,
  scanMode: ScanMode = 'surround',
  lookDir: LookDir = 'front',
) {
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

  const windshield = scanMode === 'windshield';
  const rear = windshield && lookDir === 'rear';
  const along = rear ? -1 : 1;
  const range = windshield ? WINDSHIELD_RANGE : WORLD_RANGE;
  const fovHalf = WINDSHIELD_FOV / 2;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const ox = cssW / 2;
  const oy = cssH * (windshield ? 0.88 : 0.58);
  let scale: number;
  if (windshield) {
    const halfW = range * Math.tan(fovHalf);
    scale = Math.min(cssW / (halfW * 2.2), cssH / (range * pitch * 1.28)) * zoom;
  } else {
    const extent = range * (Math.abs(cos) + Math.abs(sin));
    scale = Math.min(cssW / (extent * 2.2), cssH / (extent * 2.2 * pitch)) * zoom;
  }
  const heightPx = scale * 1.35;

  const project = (x: number, y: number, z: number): Pt => {
    const rx = cos * y - sin * x;
    const ry = sin * y + cos * x;
    return {
      x: ox + rx * scale,
      y: oy - ry * scale * pitch - z * heightPx,
      d: cos * x + sin * y,
    };
  };

  const inFov = (x: number, y: number) => {
    if (!windshield) return true;
    if (rear) {
      if (x > 0.6) return false;
      return Math.abs(Math.atan2(y, -x)) <= fovHalf + 0.06;
    }
    if (x < -0.6) return false;
    return Math.abs(Math.atan2(y, x)) <= fovHalf + 0.06;
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
  if (windshield) {
    for (let v = 5; v <= range; v += 5) {
      const span = v * Math.tan(fovHalf);
      const a = project(along * v, -span, 0);
      const b = project(along * v,  span, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const az of [-fovHalf, -fovHalf / 2, 0, fovHalf / 2, fovHalf]) {
      const a = project(0, 0, 0);
      const b = project(along * Math.cos(az) * range, Math.sin(az) * range, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  } else {
    for (let v = -range; v <= range; v += 5) {
      const a = project(-range, v, 0);
      const b = project( range, v, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = project(v, -range, 0);
      const d = project(v,  range, 0);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
  }
  ctx.restore();

  if (windshield) {
    const origin = project(0, 0, 0);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    for (let i = 0; i <= 48; i++) {
      const az = -fovHalf + (i / 48) * WINDSHIELD_FOV;
      const p = project(along * Math.cos(az) * range, Math.sin(az) * range, 0);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(188,227,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(188,227,255,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const drawRing = (r: number, color: string, width: number) => {
    ctx.beginPath();
    const steps = windshield ? 36 : 72;
    const a0 = windshield ? (rear ? Math.PI - fovHalf : -fovHalf) : 0;
    const a1 = windshield ? (rear ? Math.PI + fovHalf : fovHalf) : Math.PI * 2;
    for (let i = 0; i <= steps; i++) {
      const t = a0 + (i / steps) * (a1 - a0);
      const p = project(Math.cos(t) * r, Math.sin(t) * r, 0);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    if (!windshield) ctx.closePath();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawRing(10, 'rgba(188,227,255,0.28)', 1);
  drawRing(30, 'rgba(188,227,255,0.18)', 1.2);

  const labelRing = (r: number, text: string, color: string) => {
    const p = project(along * r, 0, 0);
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
    .filter(({ c }) => Math.abs(c.x) <= range + 2 && Math.abs(c.y) <= range + 2 && inFov(c.x, c.y))
    .sort((a, b) => (cos * b.c.x + sin * b.c.y) - (cos * a.c.x + sin * a.c.y));

  for (const { c: cell } of visible) {
    const kind = kindOf(cell);
    const t = elevT(cell.height);
    const fade = fogFor(Math.hypot(cell.x, cell.y), t);
    const pal = (
      mappingMode === 'RAW_POINT_CLOUD' && cell.semantic_name
        ? facesFromRgb(
            SEMANTIC_RGB[cell.semantic_name] || SEMANTIC_RGB.unlabeled,
            fade,
            cell.semantic_name.includes('car') || cell.semantic_name === 'person' ? 0.55 : 0,
          )
        : facesFor(t, fade)
    );
    const { z0, z1 } = slab(cell, kind);
    const inset = cell.cell_size * VOXEL_INSET;
    const half = cell.cell_size / 2 - inset / 2;
    const x0 = cell.x - half;
    const x1 = cell.x + half;
    const y0 = cell.y - half;
    const y1 = cell.y + half;
    const p = (x: number, y: number, z: number) => project(x, y, z);

    if (Math.abs(z1 - z0) > 0.04) {
      if (cos >= 0) quad([p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], pal.right);
      else          quad([p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1)], pal.front);
      if (sin >= 0) quad([p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], pal.left);
      else          quad([p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)], pal.right);
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

export function MapCanvas({
  cells,
  loading = false,
  mappingMode = 'RAW_POINT_CLOUD',
  scanMode = 'surround',
  lookDir = 'front',
  className = '',
  onViewChange,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef(cells);
  const loadingRef = useRef(loading);
  const modeRef = useRef(mappingMode);
  const scanRef = useRef(scanMode);
  const lookRef = useRef(lookDir);
  const yawRef = useRef(DEFAULT_YAW);
  const pitchRef = useRef(DEFAULT_PITCH);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  const viewCbRef = useRef(onViewChange);
  cellsRef.current = cells;
  loadingRef.current = loading;
  modeRef.current = mappingMode;
  scanRef.current = scanMode;
  lookRef.current = lookDir;
  viewCbRef.current = onViewChange;

  const clampYaw = (yaw: number) => {
    if (scanRef.current !== 'windshield') return yaw;
    const base = lookRef.current === 'rear' ? REAR_YAW : WINDSHIELD_YAW;
    return Math.max(base - WINDSHIELD_YAW_MAX, Math.min(base + WINDSHIELD_YAW_MAX, yaw));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderMap(
      canvas,
      cellsRef.current,
      loadingRef.current,
      modeRef.current,
      yawRef.current,
      pitchRef.current,
      zoomRef.current,
      scanRef.current,
      lookRef.current,
    );
  };

  const scheduleDraw = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
      viewCbRef.current?.(yawRef.current, pitchRef.current);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(draw);
    ro.observe(canvas.parentElement ?? canvas);
    draw();
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    draw();
  }, [cells, loading, mappingMode, scanMode, lookDir]);

  useEffect(() => {
    const cam = camDefaults(scanMode, lookDir);
    yawRef.current = cam.yaw;
    pitchRef.current = cam.pitch;
    zoomRef.current = cam.zoom;
    draw();
    viewCbRef.current?.(yawRef.current, pitchRef.current);
  }, [scanMode, lookDir]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const step = e.shiftKey ? 0.12 : 0.06;
      if (e.key === 'ArrowLeft')  { yawRef.current = clampYaw(yawRef.current - step); scheduleDraw(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { yawRef.current = clampYaw(yawRef.current + step); scheduleDraw(); e.preventDefault(); }
      if (e.key === 'ArrowUp')    { pitchRef.current = Math.min(PITCH_MAX, pitchRef.current + step * 0.6); scheduleDraw(); e.preventDefault(); }
      if (e.key === 'ArrowDown')  { pitchRef.current = Math.max(PITCH_MIN, pitchRef.current - step * 0.6); scheduleDraw(); e.preventDefault(); }
      if (e.key === '=' || e.key === '+') {
        zoomRef.current = Math.min(ZOOM_MAX, zoomRef.current * 1.12);
        scheduleDraw();
        e.preventDefault();
      }
      if (e.key === '-' || e.key === '_') {
        zoomRef.current = Math.max(ZOOM_MIN, zoomRef.current / 1.12);
        scheduleDraw();
        e.preventDefault();
      }
      if (e.key === 'Home' || e.key === 'r' || e.key === 'R') {
        const cam = camDefaults(scanRef.current, lookRef.current);
        yawRef.current = cam.yaw;
        pitchRef.current = cam.pitch;
        zoomRef.current = cam.zoom;
        draw();
        viewCbRef.current?.(yawRef.current, pitchRef.current);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    yawRef.current = clampYaw(yawRef.current + dx * 0.0075);
    pitchRef.current = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitchRef.current - dy * 0.004));
    scheduleDraw();
  };

  const endDrag = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.style.cursor = 'grab';
    viewCbRef.current?.(yawRef.current, pitchRef.current);
  };

  const onDoubleClick = () => {
    const cam = camDefaults(scanRef.current, lookRef.current);
    yawRef.current = cam.yaw;
    pitchRef.current = cam.pitch;
    zoomRef.current = cam.zoom;
    draw();
    viewCbRef.current?.(yawRef.current, pitchRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-delta * 0.00135);
      zoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current * factor));
      scheduleDraw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'none' }}
    />
  );
}
