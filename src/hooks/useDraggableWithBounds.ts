import { useState, useRef, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableWithBoundsReturn {
  position: Position;
  setPosition: React.Dispatch<React.SetStateAction<Position>>;
  handlePointerDown: (e: React.PointerEvent) => void;
  hasMoved: React.MutableRefObject<boolean>;
  isDragging: boolean;
}

/**
 * Hook for making an element draggable within window bounds.
 * Handles pointer events, movement detection, and boundary constraints.
 */
export const useDraggableWithBounds = (
  initialPosition: Position,
  width: number,
  height: number,
  onDragEnd?: (pos: Position) => void
): UseDraggableWithBoundsReturn => {
  const [position, setPosition] = useState(initialPosition);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const itemStartPos = useRef({ x: 0, y: 0 });

  const latestPosition = useRef(initialPosition);

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  // Keep ref in sync with state for initialization/external updates
  useEffect(() => {
    latestPosition.current = position;
  }, [position]);

  const handlePointerDown = (e: React.PointerEvent) => {
    hasMoved.current = false;
    // Only left click for mouse; all pointer types for touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // Don't drag if the event comes from the opacity slider or other range inputs
    const target = e.target as HTMLElement;
    if (target.classList.contains('opacitySlider') ||
      target.closest('.opacityRow') ||
      (target instanceof HTMLInputElement && target.type === 'range')) {
      return;
    }

    isDragging.current = true;
    setIsDraggingState(true);
    hasMoved.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    itemStartPos.current = position;
    latestPosition.current = position; // Sync start position

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    // Capture the pointer to ensure we get events even if it leaves the element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    // Threshold for "drag vs click": Increased to 10px to avoid accidental nudges
    if (!hasMoved.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      hasMoved.current = true;
    }

    // Only update position IF we have moved beyond the threshold
    if (hasMoved.current) {
      const newX = clamp(itemStartPos.current.x + dx, 0, window.innerWidth - width);
      const newY = clamp(itemStartPos.current.y + dy, 0, window.innerHeight - height);
      const newPos = { x: newX, y: newY };
      setPosition(newPos);
      latestPosition.current = newPos; // Update ref
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isDragging.current) {
      if (onDragEnd) {
        onDragEnd(latestPosition.current); // Use fresh ref value
      }
    }
    isDragging.current = false;
    setIsDraggingState(false);
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if already released or invalid
    }
  };

  // Adjust position on resize OR dimension change (e.g. collapse/expand) to keep it in bounds
  useEffect(() => {
    setPosition(p => ({
      x: clamp(p.x, 0, window.innerWidth - width),
      y: clamp(p.y, 0, window.innerHeight - height)
    }));
  }, [width, height]);

  // Window resize separate listener
  useEffect(() => {
    const handleResize = () => {
      setPosition(p => ({
        x: clamp(p.x, 0, window.innerWidth - width),
        y: clamp(p.y, 0, window.innerHeight - height)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  return { position, setPosition, handlePointerDown, hasMoved, isDragging: isDraggingState };
};
