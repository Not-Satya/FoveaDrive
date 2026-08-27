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
const WINDSHIELD_YAW = Math.PI / 11;
const REAR_YAW = Math.PI + WINDSHIELD_YAW;
const WINDSHIELD_PITCH = 0.46;
const WINDSHIELD_ZOOM = 1.58;
const PITCH_MIN = 0.22;
const PITCH_MAX = 0.92;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 5;
const VOXEL_INSET = 0.10;

type CamPose = { yaw: number; pitch: number; zoom: number; blend: number; heading: number };

function camDefaults(mode: ScanMode, look: LookDir = 'front'): CamPose {
  const heading = look === 'rear' ? Math.PI : 0;
  if (mode === 'windshield') {
    return {
      yaw: heading + WINDSHIELD_YAW,
      pitch: WINDSHIELD_PITCH,
      zoom: WINDSHIELD_ZOOM,
      blend: 1,
      heading,
    };
  }
  return { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: DEFAULT_ZOOM, blend: 0, heading: 0 };
}

function wrapPi(d: number) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function easeInOut(t: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function easeOutCubic(t: number) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function delayEase(t: number, hold: number) {
  if (t <= hold) return 0;
  return easeInOut((t - hold) / (1 - hold));
}

function fitScale(cssW: number, cssH: number, pose: CamPose) {
  const { yaw, pitch, zoom, blend } = pose;
  if (blend > 0.5) {
    const halfW = WINDSHIELD_RANGE * Math.tan(WINDSHIELD_FOV / 2);
    return Math.min(cssW / (halfW * 2.2), cssH / (WINDSHIELD_RANGE * pitch * 1.28)) * zoom;
  }
  const extent = WORLD_RANGE * (Math.abs(Math.cos(yaw)) + Math.abs(Math.sin(yaw)));
  return Math.min(cssW / (extent * 2.2), cssH / (extent * 2.2 * pitch)) * zoom;
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
  _loading: boolean,
  mappingMode: MappingMode = 'DRIVABILITY_MAP',
  yaw = DEFAULT_YAW,
  pitch = DEFAULT_PITCH,
  zoom = DEFAULT_ZOOM,
  scanMode: ScanMode = 'surround',
  lookDir: LookDir = 'front',
  blend = scanMode === 'windshield' ? 1 : 0,
  scaleOverride: number | null = null,
  heading = lookDir === 'rear' ? Math.PI : 0,
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

  const b = Math.max(0, Math.min(1, blend));
  const range = lerp(WORLD_RANGE, WINDSHIELD_RANGE, b);
  const fovHalf = lerp(Math.PI * 0.98, WINDSHIELD_FOV / 2, b);
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  const px = -hy;
  const py = hx;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const ox = cssW / 2;
  const oy = cssH * lerp(0.58, 0.88, b);
  const pose: CamPose = { yaw, pitch, zoom, blend: b };
  const scale = scaleOverride ?? fitScale(cssW, cssH, pose);
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
    if (b < 0.1) return true;
    return Math.abs(wrapPi(Math.atan2(y, x) - heading)) <= fovHalf + 0.06;
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
  if (b < 0.55) {
    ctx.globalAlpha = 1 - b * 1.15;
    ctx.strokeStyle = 'rgba(43,76,111,0.22)';
    for (let v = -range; v <= range; v += 5) {
      const a = project(-range, v, 0);
      const c2 = project(range, v, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
      const c = project(v, -range, 0);
      const d = project(v, range, 0);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
  }
  if (b > 0.2) {
    ctx.globalAlpha = Math.min(1, (b - 0.2) / 0.55);
    ctx.strokeStyle = 'rgba(43,76,111,0.22)';
    for (let v = 5; v <= range; v += 5) {
      const span = v * Math.tan(WINDSHIELD_FOV / 2);
      const a = project(hx * v - px * span, hy * v - py * span, 0);
      const bb = project(hx * v + px * span, hy * v + py * span, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
    }
    for (const az of [-WINDSHIELD_FOV / 2, -WINDSHIELD_FOV / 4, 0, WINDSHIELD_FOV / 4, WINDSHIELD_FOV / 2]) {
      const a = project(0, 0, 0);
      const bb = project(Math.cos(heading + az) * range, Math.sin(heading + az) * range, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
    }
  }
  ctx.restore();

  if (b > 0.04) {
    const origin = project(0, 0, 0);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    for (let i = 0; i <= 48; i++) {
      const az = heading - WINDSHIELD_FOV / 2 + (i / 48) * WINDSHIELD_FOV;
      const p = project(Math.cos(az) * range, Math.sin(az) * range, 0);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(188,227,255,${0.045 * b})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(188,227,255,${0.35 * b})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const drawRing = (r: number, color: string, width: number) => {
    ctx.beginPath();
    const steps = Math.round(lerp(72, 36, b));
    const a0 = lerp(0, heading - WINDSHIELD_FOV / 2, b);
    const a1 = lerp(Math.PI * 2, heading + WINDSHIELD_FOV / 2, b);
    for (let i = 0; i <= steps; i++) {
      const t = a0 + (i / steps) * (a1 - a0);
      const p = project(Math.cos(t) * r, Math.sin(t) * r, 0);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    if (b < 0.2) ctx.closePath();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawRing(10, 'rgba(188,227,255,0.28)', 1);
  drawRing(30, 'rgba(188,227,255,0.18)', 1.2);

  const labelRing = (r: number, text: string, color: string) => {
    const p = project(hx * r, hy * r, 0);
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
  const blendRef = useRef(scanMode === 'windshield' ? 1 : 0);
  const headingRef = useRef(lookDir === 'rear' ? Math.PI : 0);
  const scaleAnimRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  const camAnimRef = useRef(0);
  const camInitRef = useRef(true);
  const pendingPoseRef = useRef<CamPose | null>(null);
  const incomingCellsRef = useRef<GridCell[] | null>(null);
  const frozenRef = useRef(false);
  const awaitingLoadRef = useRef(false);
  const sawLoadRef = useRef(false);
  const viewCbRef = useRef(onViewChange);
  if (!frozenRef.current) cellsRef.current = cells;
  loadingRef.current = loading;
  modeRef.current = mappingMode;
  scanRef.current = scanMode;
  lookRef.current = lookDir;
  viewCbRef.current = onViewChange;

  const clampYaw = (yaw: number) => {
    if (camAnimRef.current || scanRef.current !== 'windshield') return yaw;
    const base = headingRef.current + WINDSHIELD_YAW;
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
      blendRef.current,
      scaleAnimRef.current,
      headingRef.current,
    );
  };

  const stopCamAnim = () => {
    if (!camAnimRef.current) return;
    cancelAnimationFrame(camAnimRef.current);
    camAnimRef.current = 0;
    scaleAnimRef.current = null;
  };

  const panTo = (to: CamPose, onDone?: () => void) => {
    stopCamAnim();
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const cssW = parent?.clientWidth || canvas?.clientWidth || 1;
    const cssH = parent?.clientHeight || canvas?.clientHeight || 1;
    const from: CamPose = {
      yaw: yawRef.current,
      pitch: pitchRef.current,
      zoom: zoomRef.current,
      blend: blendRef.current,
      heading: headingRef.current,
    };
    const fromScale = fitScale(cssW, cssH, from);
    const toScale = fitScale(cssW, cssH, to);
    let dyaw = to.yaw - from.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const enteringWindshield = to.blend > from.blend + 0.05;
    const ms = enteringWindshield
      ? Math.max(740, Math.min(980, 680 + Math.abs(dyaw) * 260))
      : Math.max(520, Math.min(880, 480 + Math.abs(dyaw) * 240 + Math.abs(to.blend - from.blend) * 180));
    const finish = () => {
      camAnimRef.current = 0;
      scaleAnimRef.current = null;
      onDone?.();
      draw();
    };
    if (ms < 530 && Math.abs(dyaw) < 0.012 && Math.abs(to.pitch - from.pitch) < 0.01 && Math.abs(to.blend - from.blend) < 0.01) {
      yawRef.current = to.yaw;
      pitchRef.current = to.pitch;
      zoomRef.current = to.zoom;
      blendRef.current = to.blend;
      headingRef.current = to.heading;
      finish();
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const eCam = enteringWindshield ? easeOutCubic(u) : easeInOut(u);
      const eBlend = enteringWindshield ? delayEase(u, 0.3) : easeInOut(u);
      yawRef.current = lerpAngle(from.yaw, to.yaw, eCam);
      pitchRef.current = lerp(from.pitch, to.pitch, eCam);
      zoomRef.current = lerp(from.zoom, to.zoom, eCam);
      blendRef.current = lerp(from.blend, to.blend, eBlend);
      headingRef.current = lerpAngle(from.heading, to.heading, eCam);
      scaleAnimRef.current = lerp(fromScale, toScale, eCam);
      draw();
      viewCbRef.current?.(yawRef.current, pitchRef.current);
      if (u < 1) camAnimRef.current = requestAnimationFrame(tick);
      else finish();
    };
    camAnimRef.current = requestAnimationFrame(tick);
  };

  const beginHeldPan = () => {
    const pose = pendingPoseRef.current;
    if (!pose) return;
    pendingPoseRef.current = null;
    awaitingLoadRef.current = false;
    const enteringWindshield = pose.blend > blendRef.current + 0.05;
    if (!enteringWindshield && incomingCellsRef.current) {
      cellsRef.current = incomingCellsRef.current;
    }
    panTo(pose, () => {
      if (incomingCellsRef.current) {
        cellsRef.current = incomingCellsRef.current;
        incomingCellsRef.current = null;
      }
      frozenRef.current = false;
    });
  };

  const sweepWedge = (toHeading: number) => {
    stopCamAnim();
    const fromH = headingRef.current;
    let d = wrapPi(toHeading - fromH);
    if (Math.abs(d) < 0.04) {
      headingRef.current = toHeading;
      yawRef.current = toHeading + WINDSHIELD_YAW;
      draw();
      return;
    }
    if (Math.abs(Math.abs(d) - Math.PI) < 0.04) d = fromH < Math.PI / 2 ? Math.PI : -Math.PI;
    const ms = 820;
    const t0 = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const e = easeInOut(u);
      const h = fromH + d * e;
      headingRef.current = h;
      yawRef.current = h + WINDSHIELD_YAW;
      draw();
      viewCbRef.current?.(yawRef.current, pitchRef.current);
      if (u < 1) camAnimRef.current = requestAnimationFrame(tick);
      else {
        headingRef.current = toHeading;
        yawRef.current = toHeading + WINDSHIELD_YAW;
        camAnimRef.current = 0;
        draw();
        viewCbRef.current?.(yawRef.current, pitchRef.current);
      }
    };
    camAnimRef.current = requestAnimationFrame(tick);
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
      stopCamAnim();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (frozenRef.current) {
      incomingCellsRef.current = cells;
      return;
    }
    cellsRef.current = cells;
    draw();
  }, [cells, mappingMode]);

  useEffect(() => {
    const pose = camDefaults(scanMode, lookRef.current);
    if (camInitRef.current) {
      camInitRef.current = false;
      yawRef.current = pose.yaw;
      pitchRef.current = pose.pitch;
      zoomRef.current = pose.zoom;
      blendRef.current = pose.blend;
      headingRef.current = pose.heading;
      draw();
      viewCbRef.current?.(yawRef.current, pitchRef.current);
      return;
    }
    stopCamAnim();
    panTo(pose);
  }, [scanMode]);

  useEffect(() => {
    const target = lookDir === 'rear' ? Math.PI : 0;
    if (scanRef.current !== 'windshield') {
      headingRef.current = target;
      return;
    }
    if (Math.abs(wrapPi(target - headingRef.current)) < 0.04) {
      headingRef.current = target;
      return;
    }
    sweepWedge(target);
  }, [lookDir]);

  useEffect(() => {
    if (!awaitingLoadRef.current) return;
    if (loading) {
      sawLoadRef.current = true;
      incomingCellsRef.current = cells;
      return;
    }
    if (!sawLoadRef.current) return;
    incomingCellsRef.current = cells;
    awaitingLoadRef.current = false;
    beginHeldPan();
  }, [loading, cells]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const step = e.shiftKey ? 0.12 : 0.06;
      if (e.key === 'ArrowLeft')  { stopCamAnim(); yawRef.current = clampYaw(yawRef.current - step); scheduleDraw(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { stopCamAnim(); yawRef.current = clampYaw(yawRef.current + step); scheduleDraw(); e.preventDefault(); }
      if (e.key === 'ArrowUp')    { stopCamAnim(); pitchRef.current = Math.min(PITCH_MAX, pitchRef.current + step * 0.6); scheduleDraw(); e.preventDefault(); }
      if (e.key === 'ArrowDown')  { stopCamAnim(); pitchRef.current = Math.max(PITCH_MIN, pitchRef.current - step * 0.6); scheduleDraw(); e.preventDefault(); }
      if (e.key === '=' || e.key === '+') {
        stopCamAnim();
        zoomRef.current = Math.min(ZOOM_MAX, zoomRef.current * 1.12);
        scheduleDraw();
        e.preventDefault();
      }
      if (e.key === '-' || e.key === '_') {
        stopCamAnim();
        zoomRef.current = Math.max(ZOOM_MIN, zoomRef.current / 1.12);
        scheduleDraw();
        e.preventDefault();
      }
      if (e.key === 'Home' || e.key === 'r' || e.key === 'R') {
        panTo(camDefaults(scanRef.current, lookRef.current));
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    stopCamAnim();
    blendRef.current = scanRef.current === 'windshield' ? 1 : 0;
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
    panTo(camDefaults(scanRef.current, lookRef.current));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stopCamAnim();
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
