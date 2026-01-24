import clsx from 'clsx';
import { Shapes } from 'lucide-react';
import styles from '../Bubble.module.css';
import { ScribbleIcon } from '../icons';
import { sizeMap, fontFamilies } from '../utils';

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
  handleExpandCheck: () => void;
}

/**
 * Collapsed view of the Bubble component.
 * Shows a visual indicator based on the active tool.
 */
export const BubbleCollapsed = ({
  activeTool,
  isEditingRichText,
  isSelectTool,
  isAllText,
  isAllShape,
  currentFont,
  currentSize,
  activeColorHex,
  richStats,
  isDragging,
  position,
  handlePointerDown,
  handleExpandCheck,
}: BubbleCollapsedProps) => {
  const isTextMode = activeTool === 'text' || isEditingRichText || (isSelectTool && isAllText);
  const isShapeMode = activeTool === 'geo' || activeTool === 'arrow' || activeTool === 'line' || activeTool === 'shapes' || (isSelectTool && isAllShape);

  return (
    <div
      className={clsx(styles.bubble, styles.collapsed, isDragging && styles.dragging)}
      style={{
        left: position.x,
        top: position.y,
        backgroundColor: 'var(--glass-bg)',
        pointerEvents: 'auto'
      }}
      onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e); }}
      onClick={handleExpandCheck}
      data-is-ui="true"
    >
      {isTextMode ? (
        <div style={{
          fontFamily: fontFamilies[currentFont] || fontFamilies.sans,
          color: activeColorHex,
          fontSize: '24px',
          fontWeight: richStats.bold ? 'bold' : 'normal',
          fontStyle: richStats.italic ? 'italic' : 'normal',
          textDecoration: [
            richStats.underline ? 'underline' : '',
            richStats.strike ? 'line-through' : ''
          ].filter(Boolean).join(' ') || 'none',
          pointerEvents: 'none'
        }}>
          A
        </div>
      ) : isShapeMode ? (
        <Shapes size={24} />
      ) : (
        <ScribbleIcon strokeWidth={sizeMap[currentSize] || 2.5} color={activeColorHex} />
      )}
    </div>
  );
};
