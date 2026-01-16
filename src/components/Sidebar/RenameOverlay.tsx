
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './RenameOverlay.module.css';
import { X, Eraser } from 'lucide-react';
import { DefaultColorThemePalette } from 'tldraw';

interface RenameOverlayProps {
  initialName: string;
  initialStrokes?: string;
  initialColor?: string;
  onSave: (name: string, strokes?: string, color?: string) => void;
  onCancel: () => void;
  anchorRect: DOMRect;
}

export const RenameOverlayV2 = ({ initialName, initialStrokes, initialColor, onSave, onCancel, anchorRect }: RenameOverlayProps) => {
  const [name, setName] = useState(initialName);
  const [paths, setPaths] = useState<string[]>(initialStrokes ? [initialStrokes] : []);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(initialColor || 'auto');
  const [scrollLeft, setScrollLeft] = useState(0);
  const [lastPointerType, setLastPointerType] = useState<string>('mouse');
  const isDrawing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollGroupRef = useRef<SVGGElement>(null);

  // Use DefaultColorThemePalette logic directly since we are outside Tldraw context
  // We can just rely on basic "light" mode palette for mapping, or CSS vars.
  // Actually, we want to know if it is dark mode to pick the right HEX for the swatch background.
  // Since we are outside Tldraw, we can check the 'data-theme' attribute on the document element or use a media query.
  // But simpler: just use CSS variables for background colors of swatches, or map them to the Palette.
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (document.documentElement.getAttribute('data-theme') === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const theme = isDarkMode ? DefaultColorThemePalette.darkMode : DefaultColorThemePalette.lightMode;

  // Colors mapping (using Tldraw's actual theme engine)
  const colorsMap: Record<string, string> = {
    auto: theme.black.solid, // Represents "Auto" / Inherit
    grey: theme.grey.solid,
    blue: theme.blue.solid,
    red: theme.red.solid,
    yellow: theme.yellow.solid,
    green: theme.green.solid,
    violet: theme.violet.solid,
  };

  // Position logic: centered over the anchor, but slightly larger
  const width = 450; // Increased from 340
  const height = 165; // Adjusted to be even tighter per user request
  const margin = 10;

  let top = anchorRect.top - (height - anchorRect.height) / 2;
  let left = anchorRect.left - (width - anchorRect.width) / 2;

  // Clamp to viewport
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSave(name, paths.join(' '), selectedColor);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [name, paths, selectedColor, onCancel, onSave]);

  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    const sl = e.currentTarget.scrollLeft;
    setScrollLeft(sl);
    if (scrollGroupRef.current) {
      scrollGroupRef.current.setAttribute('transform', `translate(${-sl}, 0)`);
    }
  };

  const startDrawing = (e: React.PointerEvent) => {
    if (e.pointerType !== 'pen' && e.pointerType !== 'touch') return;

    // For pen/touch, we prevent default to stop focus/text selection on the input below
    e.preventDefault();
    e.stopPropagation();

    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDrawing.current = true;
    const pos = getPos(e);
    // pos.x is relative to inputWrapper padding start now
    setCurrentPath(`M ${pos.x} ${pos.y}`);
  };

  const draw = (e: React.PointerEvent) => {
    setLastPointerType(e.pointerType);
    if (!isDrawing.current) return;
    const pos = getPos(e);
    setCurrentPath(prev => `${prev} L ${pos.x} ${pos.y}`);
  };

  const stopDrawing = () => {
    if (isDrawing.current && currentPath) {
      setPaths(prev => [...prev, currentPath]);
    }
    isDrawing.current = false;
    setCurrentPath("");
  };

  const getPos = (e: React.PointerEvent) => {
    // Crucial: Use the inputWrapper (currentTarget) or containerRef for coordinates
    // If listeners are on inputWrapper, currentTarget is inputWrapper.
    // However, if we draw over the input, the rect should be relative to where the SVG starts.
    const wrapper = containerRef.current?.querySelector(`.${styles.inputWrapper}`);
    const rect = wrapper?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    // SVG coordinate space is 1x (height 40). UI is 2x (height 80).
    // Padding 16px in UI = 8px in SVG space.
    const SCALE = 2;
    return {
      x: (e.clientX - rect.left - 16 + scrollLeft) / SCALE,
      y: (e.clientY - rect.top) / SCALE
    };
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  // Sync scroll on text change (input auto-scrolls when typing)
  useEffect(() => {
    if (inputRef.current) {
      const sl = inputRef.current.scrollLeft;
      setScrollLeft(sl);
      if (scrollGroupRef.current) {
        scrollGroupRef.current.setAttribute('transform', `translate(${-sl}, 0)`);
      }
    }
  }, [name]);



  return createPortal(
    <div className={styles.backdrop} onClick={handleOverlayClick}>
      <div
        className={styles.overlay}
        style={{
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`
        }}
        ref={containerRef}
        onClick={(e) => e.stopPropagation()} // Stop propagation from clicking inside the overlay
      >
        <div className={styles.container}>
          <div
            className={styles.inputWrapper}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
            onPointerEnter={(e) => setLastPointerType(e.pointerType)}
            style={{
              cursor: lastPointerType === 'pen' ? 'crosshair' : 'text',
              direction: 'ltr', /* Force LTR for the coordinate system to match SVG, but handle visual RTL via CSS */
            }}
          >
            <input
              ref={inputRef}
              autoFocus
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onScroll={handleScroll}
              style={{ cursor: 'inherit', textAlign: 'start' }}
            />
            <svg className={styles.svgOverlay} viewBox="0 0 2000 40" preserveAspectRatio="xMinYMin slice">
              {/* The strokes AND the guide move with the text scroll */}
              <g ref={scrollGroupRef} transform={`translate(${-scrollLeft / 2}, 0)`}>
                {/* Visible Area Guide - now anchored to text start */}
                <rect
                  x="0"
                  y="0"
                  width="140"
                  height="40"
                  rx="4"
                  className={styles.guideRect}
                />
                {paths.map((p, i) => <path key={i} d={p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />)}
                {currentPath && <path d={currentPath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
              </g>
            </svg>

          </div>

          <div className={styles.actions}>
            <div className={styles.colorsRow}>
              {Object.entries(colorsMap).map(([key, hex]) => (
                <button
                  key={key}
                  className={styles.colorSwatch}
                  style={{
                    backgroundColor: hex,
                    boxShadow: selectedColor === key
                      ? `0 0 0 2px hsl(var(--color-bg-primary)), 0 0 0 4px ${hex}`
                      : undefined
                  }}
                  onClick={() => setSelectedColor(key)}
                  title={key === 'auto' ? 'Auto' : key}
                >
                  {/* Visual cue for auto handled by box-shadow or just plain */}
                </button>
              ))}
            </div>

            <div className={styles.buttonsGroup}>
              <button className={styles.btn} onClick={(e) => { e.stopPropagation(); setName(""); setPaths([]); }} title="Clear All"><Eraser size={20} /></button>
              <button className={styles.btn} onClick={(e) => { e.stopPropagation(); onCancel(); }} title="Cancel"><X size={20} /></button>
              <button
                className={styles.confirm}
                onClick={(e) => { e.stopPropagation(); onSave(name, paths.join(' '), selectedColor); }}
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
