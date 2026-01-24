import { useEffect, useRef } from 'react';
import { Editor, createShapeId, transact } from 'tldraw';
import styles from '../components/Canvas/CanvasArea.module.css';

export const useCanvasInteractions = (
  editor: Editor,
  parentRef: React.RefObject<HTMLDivElement | null>,
  manualTool: string,
  setIsLockingUI: (locking: boolean) => void,
  userPrefs: any,
  lastGeoToolRef: React.MutableRefObject<string>
) => {
  const isPanningRef = useRef(false);
  const isZoomingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const startPanningPointRef = useRef({ x: 0, y: 0 });
  const startPanningCameraRef = useRef({ x: 0, y: 0, z: 1 });
  const previousToolRef = useRef('select');

  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    const handlePointerDownCapture = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-is-ui="true"]')) return;
      if (e.button !== 0) return;

      const toolId = editor.getCurrentToolId();
      if (toolId !== 'text') return;

      const p = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const shape = editor.getShapeAtPoint(p);

      if (shape && (shape.type === 'text' || shape.type === 'rich-text')) {
        if (editor.getEditingShapeId() === shape.id) return;
        setIsLockingUI(true);
        transact(() => {
          editor.setCurrentTool('text');
          editor.setEditingShape(shape.id);
        });
        return;
      }

      e.stopPropagation();
      const id = createShapeId();
      const startX = p.x;
      const startY = p.y;

      editor.createShape({
        id,
        type: 'rich-text',
        x: startX,
        y: startY,
        props: {
          html: '',
          autoSize: true,
          w: 200, h: 50,
          isCreating: true,
          color: userPrefs.textColor,
          size: userPrefs.textSize,
          font: userPrefs.textFont,
          align: userPrefs.textAlign,
          bold: userPrefs.textBold,
          italic: userPrefs.textItalic,
          underline: userPrefs.textUnderline,
          strike: userPrefs.textStrike
        }
      });

      editor.select(id);
      if (parentRef.current) parentRef.current.classList.add(styles.hideSelection);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const curr = editor.screenToPage({ x: moveEvent.clientX, y: moveEvent.clientY });
        const dist = Math.hypot(curr.x - startX, curr.y - startY);
        if (dist > 5) {
          const w = Math.max(50, curr.x - startX);
          const h = Math.max(30, curr.y - startY);
          editor.updateShape({ id, type: 'rich-text', props: { w, h, autoSize: false } });
        }
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        setIsLockingUI(true);
        if (parentRef.current) parentRef.current.classList.add(styles.hideSelection);
        transact(() => {
          editor.updateShape({ id, type: 'rich-text', props: { isCreating: false } });
          editor.setCurrentTool('text');
          editor.select(id);
          editor.setEditingShape(id);
        });
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const p = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const shape = editor.getShapeAtPoint(p);
      if (shape && (shape.type === 'rich-text' || shape.type === 'text')) {
        editor.setEditingShape(shape.id);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-is-ui="true"]')) return;
      if (manualTool === 'shapes' && e.button === 0 && editor.getCurrentToolId() === 'select') {
        editor.setCurrentTool(lastGeoToolRef.current as any);
      }
      if (e.button === 1) {
        isPanningRef.current = true;
        startPanningPointRef.current = { x: e.clientX, y: e.clientY };
        startPanningCameraRef.current = editor.getCamera();
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      if (e.button === 0 && e.ctrlKey) {
        isZoomingRef.current = true;
        lastPointRef.current = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPanningRef.current) {
        const deltaX = e.clientX - startPanningPointRef.current.x;
        const deltaY = e.clientY - startPanningPointRef.current.y;
        const { x, y, z } = startPanningCameraRef.current;
        editor.setCamera({ x: x + deltaX / z, y: y + deltaY / z, z });
      } else if (isZoomingRef.current) {
        const deltaY = e.clientY - lastPointRef.current.y;
        lastPointRef.current = { x: e.clientX, y: e.clientY };
        const { z } = editor.getCamera();
        const factor = 1 - deltaY * 0.01;
        const newZoom = Math.max(0.1, Math.min(5, z * factor));
        const p = editor.screenToPage({ x: e.clientX, y: e.clientY });
        const rect = container.getBoundingClientRect();
        const newX = ((e.clientX - rect.left) / newZoom) - p.x;
        const newY = ((e.clientY - rect.top) / newZoom) - p.y;
        editor.setCamera({ x: newX, y: newY, z: newZoom });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isPanningRef.current || isZoomingRef.current) {
        isPanningRef.current = false;
        isZoomingRef.current = false;
        try { container.releasePointerCapture(e.pointerId); } catch (err) { }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const { z } = editor.getCamera();
      const factor = 1 - e.deltaY * 0.001;
      const safeFactor = Math.max(0.1, Math.min(8, z * factor));
      const p = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const rect = container.getBoundingClientRect();
      const newX = ((e.clientX - rect.left) / safeFactor) - p.x;
      const newY = ((e.clientY - rect.top) / safeFactor) - p.y;
      editor.setCamera({ x: newX, y: newY, z: safeFactor });
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.getEditingShapeId()) return;
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) editor.deleteShapes(selectedIds);
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) editor.redo(); else editor.undo();
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        editor.redo();
        e.preventDefault();
        return;
      }
      if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.shiftKey && !e.altKey && editor.getCurrentToolId() !== 'hand') {
        previousToolRef.current = editor.getCurrentToolId();
        editor.setCurrentTool('hand');
      }
    };

    const handleKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.code === 'Space' && editor.getCurrentToolId() === 'hand') {
        editor.setCurrentTool(previousToolRef.current);
      }
    };

    let touchStartTime = 0;
    let initialTouches: { id: number, x: number, y: number }[] = [];
    let touchMoving = false;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 || e.touches.length === 3) {
        touchStartTime = Date.now();
        touchMoving = false;
        initialTouches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
      } else initialTouches = [];
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (initialTouches.length > 0) {
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          const initial = initialTouches.find(it => it.id === t.identifier);
          if (initial && Math.hypot(t.clientX - initial.x, t.clientY - initial.y) > 10) {
            touchMoving = true;
            break;
          }
        }
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (initialTouches.length > 0 && e.touches.length === 0) {
        if (Date.now() - touchStartTime < 300 && !touchMoving) {
          if (initialTouches.length === 2) editor.undo(); else if (initialTouches.length === 3) editor.redo();
        }
        initialTouches = [];
      }
    };

    container.addEventListener('pointerdown', handlePointerDownCapture, { capture: true });
    container.addEventListener('dblclick', handleDoubleClick);
    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDownCapture, { capture: true });
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel, { capture: true } as any);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [editor, manualTool, userPrefs, lastGeoToolRef, parentRef, setIsLockingUI]);
};
