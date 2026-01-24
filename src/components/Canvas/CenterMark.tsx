import { useEditor, track } from 'tldraw';

export const CenterMark = track(() => {
  const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';
  if (!isDebug) return null;

  const editor = useEditor();
  const screenPoint = editor.pageToScreen({ x: 0, y: 0 });

  return (
    <div
      style={{
        position: 'absolute',
        left: screenPoint.x,
        top: screenPoint.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 999,
        opacity: 0.8,
        color: '#ff0000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    </div>
  );
});
