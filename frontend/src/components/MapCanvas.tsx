// frontend/src/components/MapCanvas.tsx
//
// Renders the adaptive grid cells onto an HTML Canvas.
// Drop this anywhere inside ViewportHUD where the dark map area is.

import { useRef, useEffect } from 'react';
import type { GridCell } from '../api/foveadriveApi';

interface MapCanvasProps {
  cells: GridCell[];
  loading?: boolean;
  className?: string;
}

// World ±30 m shown on canvas
const WORLD_RANGE = 30;

export function MapCanvas({ cells, loading = false, className = '' }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const scale = W / (WORLD_RANGE * 2);

    // X = forward (right on screen), Y = lateral (up → flip canvas Y)
    const cx = (wx: number) => (wx + WORLD_RANGE) * scale;
    const cy = (wy: number) => H - (wy + WORLD_RANGE) * scale;

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, W, H);

    // ── Perspective grid lines (matches her dark HUD aesthetic) ──────────────
    ctx.strokeStyle = 'rgba(43,76,111,0.25)';
    ctx.lineWidth = 0.5;
    const gridStep = 5 * scale; // one line every 5 m
    for (let x = 0; x < W; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Zone rings ────────────────────────────────────────────────────────────
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 0.8;
    [[10, 'rgba(100,180,255,0.20)'], [30, 'rgba(100,180,255,0.10)']]
      .forEach(([r, color]) => {
        const rPx = (r as number) * scale;
        if (rPx > W / 2) return;
        ctx.beginPath();
        ctx.arc(cx(0), cy(0), rPx, 0, Math.PI * 2);
        ctx.strokeStyle = color as string;
        ctx.stroke();
        ctx.fillStyle = 'rgba(100,180,255,0.35)';
        ctx.font = '9px monospace';
        ctx.fillText(`${r}m`, cx(0) + rPx + 2, cy(0) - 3);
      });
    ctx.setLineDash([]);

    // ── Grid cells ────────────────────────────────────────────────────────────
    for (const cell of cells) {
      const cs = cell.cell_size * scale;
      const px = cx(cell.x) - cs / 2;
      const py = cy(cell.y) - cs / 2;
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = cell.color;
      ctx.fillRect(px, py, cs, cs);
      // Fine border on near cells to visually show higher resolution
      if (cell.zone === 'near' && cs > 4) {
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.4;
        ctx.strokeRect(px, py, cs, cs);
      }
    }
    ctx.globalAlpha = 1;

    // ── Vehicle marker (white triangle, origin) ───────────────────────────────
    const vx = cx(0), vy = cy(0), vs = 9;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(150,220,255,0.6)';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(vx, vy - vs);
    ctx.lineTo(vx - vs * 0.6, vy + vs * 0.7);
    ctx.lineTo(vx + vs * 0.6, vy + vs * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Loading overlay ───────────────────────────────────────────────────────
    if (loading) {
      ctx.fillStyle = 'rgba(5,8,15,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(100,180,255,0.7)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PROCESSING...', W / 2, H / 2);
      ctx.textAlign = 'left';
    }
  }, [cells, loading]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={640}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
