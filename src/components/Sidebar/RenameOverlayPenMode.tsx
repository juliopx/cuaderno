import React, { useRef, useEffect } from 'react';
import styles from './RenameOverlay.module.css';
import { X } from 'lucide-react';
import { HybridName } from '../UI/HybridName';

interface RenameOverlayPenModeProps {
  name: string;
  strokes?: string;
  setStrokes: (strokes: string | undefined) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  onSave: () => void;
  onClear: () => void;
  colorsMap: Record<string, string>;
}

export const RenameOverlayPenMode = ({
  name,
  strokes,
  setStrokes,
  selectedColor,
  setSelectedColor,
  onSave,
  onClear,
  colorsMap
}: RenameOverlayPenModeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPathPoints = useRef<{ x: number; y: number }[]>([]);
  const currentPaths = useRef<string[]>([]);

  // Initialize canvas and draw initial strokes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || 418;
    const cssHeight = rect.height || 80;
    const scale = cssHeight / 40; // Usually 2.0

    // Setup HiDPI and global translation
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr * scale, dpr * scale);
    ctx.translate(8.5, 0); // Always stay shifted to text start (17px / 2 = 8.5)

    // Set drawing styles
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;

    // Clear canvas before redrawing
    ctx.clearRect(-8, 0, canvas.width / (dpr * scale), canvas.height / (dpr * scale));

    // Draw strokes from prop (no need to save/restore translate)
    if (strokes) {
      const segments = strokes.split('M').filter(s => s.trim());
      segments.forEach(seg => {
        const points = seg.split('L').map(p => {
          const coords = p.trim().split(' ');
          if (coords.length < 2) return null;
          return { x: Number(coords[0]), y: Number(coords[1]) };
        }).filter((p): p is { x: number, y: number } => p !== null);

        if (points.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = colorsMap[selectedColor];
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
      });
      // Sync internal paths ref
      currentPaths.current = strokes.split('M').filter(s => s.trim()).map(s => 'M' + s);
    } else {
      currentPaths.current = [];
    }
  }, [strokes, colorsMap, selectedColor]);

  const startDrawing = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerType !== 'pen') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Force scale to exactly 2.0 if we are near 80px to avoid float drift
    const scale = Math.abs(rect.height - 80) < 2 ? 2.0 : rect.height / 40;

    // x=0 is at rect.left + 1px border + 16px padding
    // 16px padding / 2.0 scale = 8 units. 
    // 1px border / 2.0 scale = 0.5 units.
    const borderOffset = 1 / scale;
    const x = (e.clientX - rect.left) / scale - 8 - borderOffset;
    const y = (e.clientY - rect.top) / scale;

    isDrawing.current = true;
    currentPathPoints.current = [{ x, y }];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = colorsMap[selectedColor];
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawing.current || e.pointerType !== 'pen') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = 2.0;
    const x = (e.clientX - rect.left) / scale - 8.5;
    const y = (e.clientY - rect.top) / scale;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    currentPathPoints.current.push({ x, y });
  };

  const stopDrawing = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDrawing.current) {
      isDrawing.current = false;
      if (currentPathPoints.current.length > 0) {
        const first = currentPathPoints.current[0];
        let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
        for (let i = 1; i < currentPathPoints.current.length; i++) {
          path += ` L ${currentPathPoints.current[i].x.toFixed(2)} ${currentPathPoints.current[i].y.toFixed(2)}`;
        }
        const updatedPaths = [...currentPaths.current, path];
        setStrokes(updatedPaths.join(' '));
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper} style={{ color: colorsMap[selectedColor] }}>
        <HybridName
          name={name || ' '}
          strokes={undefined}
          scale={2}
          isEditor={true}
          className={styles.penModeBackground}
        />
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onLostPointerCapture={stopDrawing}
          onTouchStart={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
          onTouchEnd={(e) => e.preventDefault()}
          onTouchCancel={(e) => e.preventDefault()}
        />
      </div>

      <div className={styles.actions}>
        <div className={styles.colorsRow}>
          {Object.entries(colorsMap).map(([cName, hex]) => (
            <button
              key={cName}
              className={styles.colorSwatch}
              style={{
                backgroundColor: hex,
                outline: selectedColor === cName ? '2px solid var(--color-accent)' : 'none',
                outlineOffset: '2px'
              }}
              onClick={() => setSelectedColor(cName)}
              title={cName}
            />
          ))}
        </div>

        <div className={styles.buttonsGroup}>
          <button className={styles.btn} onClick={onClear} title="Clear All">
            <X size={20} />
          </button>
          <button className={styles.confirm} onClick={onSave}>
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
};
