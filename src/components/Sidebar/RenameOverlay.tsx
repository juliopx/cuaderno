import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './RenameOverlay.module.css';
import { DefaultColorThemePalette } from 'tldraw';
import { RenameOverlayTextMode } from './RenameOverlayTextMode';
import { RenameOverlayPenMode } from './RenameOverlayPenMode';

interface RenameOverlayProps {
  initialName: string;
  initialStrokes?: string;
  initialColor?: string;
  onSave: (name: string, strokes?: string, color?: string) => void;
  onCancel: () => void;
  anchorRect: DOMRect;
  initialPointerType?: string;
}

export const RenameOverlayV2 = ({
  initialName,
  initialStrokes,
  initialColor,
  onSave,
  onCancel,
  anchorRect,
  initialPointerType = 'mouse'
}: RenameOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);


  // Add a class to body to help CanvasArea and others know we are editing
  useLayoutEffect(() => {
    document.body.classList.add('rename-overlay-active');

    // Aggressively kill system gestures on body
    const oldTouchAction = document.body.style.touchAction;
    const oldUserSelect = document.body.style.userSelect;
    const oldWebkitUserSelect = document.body.style.webkitUserSelect;

    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.body.classList.remove('rename-overlay-active');
      document.body.style.touchAction = oldTouchAction;
      document.body.style.userSelect = oldUserSelect;
      document.body.style.webkitUserSelect = oldWebkitUserSelect;
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [onCancel]);



  // Position logic
  const width = 450;
  const height = 165;
  const margin = 10;
  let top = anchorRect.top - (height - anchorRect.height) / 2;
  let left = anchorRect.left - (width - anchorRect.width) / 2;
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

  // Theme & Colors
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (document.documentElement.getAttribute('data-theme') === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = isDarkMode ? DefaultColorThemePalette.darkMode : DefaultColorThemePalette.lightMode;
  const colorsMap: Record<string, string> = {
    auto: theme.black.solid,
    grey: theme.grey.solid,
    blue: theme.blue.solid,
    red: theme.red.solid,
    yellow: theme.yellow.solid,
    green: theme.green.solid,
    violet: theme.violet.solid,
  };

  const isPenMode = initialPointerType === 'pen';

  const [name, setName] = useState(initialName);
  const [strokes, setStrokes] = useState(initialStrokes);
  const [selectedColor, setSelectedColor] = useState<string>(initialColor || 'auto');

  const handleSave = () => {
    // Trim whitespaces as requested
    onSave(name.trim(), strokes, selectedColor);
  };

  const handleClear = () => {
    setName('');
    setStrokes(undefined);
  };

  return createPortal(
    <div
      className={styles.backdrop}
      data-is-ui="true"
      onPointerDown={(e) => {
        // Close if click is on the backdrop itself
        if (e.target === e.currentTarget) onCancel();
        e.stopPropagation();
      }}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerCancel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={styles.overlay}
        data-is-ui="true"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`
        }}
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerCancel={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isPenMode ? (
          <RenameOverlayPenMode
            name={name}
            strokes={strokes}
            setStrokes={setStrokes}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            onSave={handleSave}
            onClear={handleClear}
            colorsMap={colorsMap}
          />
        ) : (
          <RenameOverlayTextMode
            name={name}
            setName={setName}
            strokes={strokes}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            onSave={handleSave}
            onClear={handleClear}
            onCancel={onCancel}
            colorsMap={colorsMap}
          />
        )}
      </div>
    </div>,
    document.body
  );
};
