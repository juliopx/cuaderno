import { useEffect, useRef } from 'react';
import { Editor } from 'tldraw';
import { syncLog } from '../lib/debugLog';
import { useFileSystemStore } from '../store/fileSystemStore';

export const useTouchPanning = (
  editor: Editor
) => {
  const lastToolBeforeEraserRef = useRef<string | null>(null);
  const autoSwitchedEraserRef = useRef(false);

  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    const activeTouchIds = new Set<number>();
    let previousTool: string | null = null;
    let didSwitchToHand = false;

    const handlePointerDown = (e: PointerEvent) => {

      if (document.body.classList.contains('rename-overlay-active')) return;

      const target = e.target as HTMLElement;
      if (target.closest?.('[data-is-ui="true"]')) return;

      const { penMode } = useFileSystemStore.getState();
      const currentTool = editor.getCurrentToolId();

      if (e.pointerType === 'pen') {
        if (e.buttons === 32 || e.button === 5) {
          if (currentTool !== 'eraser') {
            syncLog(`✏️ [PENCIL] Eraser mode detected`);
            lastToolBeforeEraserRef.current = currentTool;
            autoSwitchedEraserRef.current = true;
            editor.setCurrentTool('eraser');
          }
        } else if (e.buttons === 1) {
          if (autoSwitchedEraserRef.current && currentTool === 'eraser') {
            syncLog(`✏️ [PENCIL] Normal mode restored`);
            const toolToRestore = lastToolBeforeEraserRef.current || 'draw';
            editor.setCurrentTool(toolToRestore);
            autoSwitchedEraserRef.current = false;
            lastToolBeforeEraserRef.current = null;
          }
        }
      }

      if (penMode && (currentTool === 'draw' || currentTool === 'eraser') && e.pointerType !== 'pen') {
        if (activeTouchIds.size === 0) {
          previousTool = currentTool;
          editor.setCurrentTool('hand');
          didSwitchToHand = true;
        }
        activeTouchIds.add(e.pointerId);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (document.body.classList.contains('rename-overlay-active')) return;
      if (activeTouchIds.has(e.pointerId)) {
        activeTouchIds.delete(e.pointerId);
        if (activeTouchIds.size === 0 && didSwitchToHand) {
          const toolToRestore = previousTool;
          didSwitchToHand = false;
          previousTool = null;
          requestAnimationFrame(() => {
            if (toolToRestore && editor && editor.getCurrentToolId() === 'hand') {
              editor.setCurrentTool(toolToRestore);
            }
          });
        }
      }
    };

    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerUp, { capture: true });
    };
  }, [editor]);

  return { lastToolBeforeEraserRef, autoSwitchedEraserRef };
};
