import { useEditor, track } from 'tldraw';
import { useState, useEffect } from 'react';

export const DebugOverlay = track(({ sidebarColumns }: { sidebarColumns: number }) => {
  const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';
  if (!isDebug) return null;

  const editor = useEditor();
  const { x, y, z } = editor.getCamera();
  const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const columnWidth = 250;
  const margin = 12;
  const sidebarWidth = sidebarColumns > 0 ? (columnWidth * sidebarColumns + margin * 2) : 0;
  const viewportCenter = (screen.w + sidebarWidth) / 2;

  // Normalized X: 0 means perfectly centered in the available space
  const normalizedX = x - (viewportCenter / z);

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '4.5rem',
        zIndex: 1000,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        padding: '0.4rem 0.8rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--glass-border)',
        fontSize: '11px',
        color: 'hsl(var(--color-text-secondary))',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        boxShadow: 'var(--shadow-md)'
      }}
    >
      <div title="Actual Camera">CAM: {x.toFixed(0)}, {y.toFixed(0)}, {z.toFixed(2)}</div>
      <div title="Normalized (Universal) Camera" style={{ color: 'var(--color-accent)' }}>NORM: {normalizedX.toFixed(0)}</div>
      <div>WIN: {screen.w}x{screen.h}</div>
      <div>SIDE: {sidebarWidth}px</div>
    </div>
  );
});
