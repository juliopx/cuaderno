import { Editor } from 'tldraw';

export const useRecenter = (editor: Editor, sidebarColumns: number, leftHandedMode: boolean) => {
  const handleRecenter = () => {
    if (!editor) return;
    const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
    const viewportCenter = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : (window.innerWidth + sidebarWidth) / 2;
    const viewportHalfHeight = window.innerHeight / 2;
    const { z } = editor.getCamera();
    editor.setCamera({ x: viewportCenter / z, y: viewportHalfHeight / z, z }, { animation: { duration: 300 } });
  };

  const handleRecenterAll = () => {
    if (!editor) return;
    const bounds = editor.getCurrentPageBounds();
    if (!bounds) return;

    const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
    const padding = 64;
    const availableWidth = window.innerWidth - sidebarWidth - padding;
    const availableHeight = window.innerHeight - padding;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const zoomX = availableWidth / bounds.w;
    const zoomY = availableHeight / bounds.h;
    const z = Math.min(zoomX, zoomY, 1);

    const targetX = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : sidebarWidth + (window.innerWidth - sidebarWidth) / 2;
    const targetY = window.innerHeight / 2;

    const camX = (targetX / z) - (bounds.x + bounds.w / 2);
    const camY = (targetY / z) - (bounds.y + bounds.h / 2);

    editor.setCamera({ x: camX, y: camY, z }, { animation: { duration: 300 } });
  };

  return { handleRecenter, handleRecenterAll };
};
