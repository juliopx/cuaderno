import { useRef } from 'react';
import clsx from 'clsx';
import { Shapes, MousePointer2, Pencil, Eraser, Type, ImagePlus } from 'lucide-react';
import styles from '../Bubble.module.css';

interface RichStats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  font: string;
  size: string;
  color: string;
  align: string;
}

interface BubbleCollapsedProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
  lastActiveTool: string;
  isEditingRichText: boolean;
  isSelectTool: boolean;
  isAllText: boolean;
  isAllShape: boolean;
  currentFont: string;
  currentSize: string;
  activeColorHex: string;
  richStats: RichStats;
  isDragging: boolean;
  position: { x: number; y: number };
  handlePointerDown: (e: React.PointerEvent) => void;
  handleExpand: () => void;
}

/**
 * Collapsed view of the Bubble component.
 * Shows only the active tool icon.
 */
export const BubbleCollapsed = ({
  activeTool,
  onSelectTool,
  lastActiveTool,
  isDragging,
  position,
  handlePointerDown,
  handleExpand,
}: BubbleCollapsedProps) => {
  const lastClickTime = useRef(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 300) {
      // Double Click -> Expand
      handleExpand();
    } else {
      // Single Click -> Toggle Eraser
      if (activeTool === 'eraser') {
        onSelectTool(lastActiveTool || 'draw');
      } else {
        onSelectTool('eraser');
      }
    }
    lastClickTime.current = now;
  };

  const renderIcon = () => {
    switch (activeTool) {
      case 'select': return <MousePointer2 size={24} />;
      case 'draw': return <Pencil size={24} />;
      case 'eraser': return <Eraser size={24} />;
      case 'text': return <Type size={24} />;
      case 'shapes':
      case 'geo':
      case 'arrow':
      case 'line':
        return <Shapes size={24} />;
      case 'image': return <ImagePlus size={24} />;
      default: return <Pencil size={24} />;
    }
  };

  return (
    <div
      className={clsx(styles.bubble, styles.collapsed, isDragging && styles.dragging)}
      style={{
        left: position.x,
        top: position.y,
        backgroundColor: 'var(--glass-bg)',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e); }}
      onClick={handleClick}
      data-is-ui="true"
    >
      {renderIcon()}
    </div>
  );
};
