import { useEffect, useRef } from 'react';
import { Editor } from 'tldraw';

export const useSidebarPanning = (editor: Editor, sidebarColumns: number, leftHandedMode: boolean) => {
  const lastSidebarColumnsRef = useRef(sidebarColumns);

  useEffect(() => {
    if (lastSidebarColumnsRef.current === sidebarColumns) return;

    const columnWidth = 250;
    const margin = 12;
    const prevWidth = lastSidebarColumnsRef.current > 0 ? (columnWidth * lastSidebarColumnsRef.current + margin * 2) : 0;
    const currWidth = sidebarColumns > 0 ? (columnWidth * sidebarColumns + margin * 2) : 0;
    const diff = currWidth - prevWidth;

    const { x, y, z } = editor.getCamera();
    // Shift camera by half the diff / zoom to keep content centered in the remaining visible space
    // If sidebar on RIGHT expands, shift camera to the LEFT (invert diff)
    const shiftX = leftHandedMode ? -diff : diff;
    editor.setCamera({ x: x + (shiftX / 2) / z, y, z }, { animation: { duration: 300 } });

    lastSidebarColumnsRef.current = sidebarColumns;
  }, [editor, sidebarColumns, leftHandedMode]);
};
