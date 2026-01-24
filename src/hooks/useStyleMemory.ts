import { useEffect, useRef } from 'react';
import { Editor, DefaultDashStyle } from 'tldraw';

export const useStyleMemory = (editor: Editor) => {
  const lastShapesDashRef = useRef<string>('solid');
  const lastPencilDashRef = useRef<string>('draw');
  const lastGeoToolRef = useRef<string>('geo');

  useEffect(() => {
    // Sync memory with current editor state when styles change
    const unlisten = editor.store.listen(() => {
      const currentDash = editor.getStyleForNextShape(DefaultDashStyle) as string;
      const currentTool = editor.getCurrentToolId();
      if (currentTool === 'geo' || currentTool === 'arrow' || currentTool === 'line' || currentTool === 'note') {
        lastShapesDashRef.current = currentDash;
        if (currentTool !== 'note') lastGeoToolRef.current = currentTool;
      } else if (currentTool === 'draw') {
        lastPencilDashRef.current = currentDash;
      }
    }, { source: 'user', scope: 'session' });
    return () => unlisten();
  }, [editor]);

  return {
    lastShapesDashRef,
    lastPencilDashRef,
    lastGeoToolRef
  };
};
