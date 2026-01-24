import clsx from 'clsx';
import {
  Square,
  Circle,
  Triangle,
  Diamond,
  Star,
  Hexagon,
  Cloud,
  Heart,
  Pentagon,
  Octagon,
  X,
  Check,
  ArrowBigUp,
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
  Minus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GeoShapeGeoStyle, Editor } from 'tldraw';
import styles from '../Bubble.module.css';
import { TrapezoidIcon } from '../icons';

interface BubbleShapeSectionProps {
  currentShapeOption: string;
  hasMoved: React.MutableRefObject<boolean>;
  editor: Editor;
  setStyle: (style: any, value: any) => void;
}

/**
 * Shape type selection section of the Bubble component.
 * Includes geometric shapes, arrows, and lines.
 */
export const BubbleShapeSection = ({
  currentShapeOption,
  hasMoved,
  editor,
  setStyle,
}: BubbleShapeSectionProps) => {
  const { t } = useTranslation();

  const handleShapeClick = (shape: string) => {
    if (!hasMoved.current) {
      if (shape === 'arrow' || shape === 'line') {
        editor.setCurrentTool(shape);
      } else {
        editor.setCurrentTool('geo');
        setStyle(GeoShapeGeoStyle, shape);
      }
    }
  };

  return (
    <div className={styles.shapeSettings}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{t('tool_shapes')}</span>
      </div>

      {/* Row 1: Basic shapes */}
      <div className={styles.styleGroup} style={{ justifyContent: 'space-between' }}>
        {['rectangle', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon'].map((shape) => {
          const isActive = currentShapeOption === shape;
          return (
            <button
              key={shape}
              className={clsx(styles.iconBtn, isActive && styles.active)}
              onClick={() => handleShapeClick(shape)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title={t(`tool_${shape === 'rectangle' ? 'square' : shape === 'ellipse' ? 'circle' : shape}`)}
            >
              {shape === 'rectangle' && <Square size={16} />}
              {shape === 'ellipse' && <Circle size={16} />}
              {shape === 'triangle' && <Triangle size={16} />}
              {shape === 'diamond' && <Diamond size={16} />}
              {shape === 'pentagon' && <Pentagon size={16} />}
              {shape === 'hexagon' && <Hexagon size={16} />}
              {shape === 'octagon' && <Octagon size={16} />}
            </button>
          );
        })}
      </div>

      {/* Row 2: Special shapes */}
      <div className={styles.styleGroup} style={{ justifyContent: 'space-between' }}>
        {['star', 'cloud', 'heart', 'oval', 'trapezoid', 'rhombus', 'x-box'].map((shape) => {
          const isActive = currentShapeOption === shape;
          return (
            <button
              key={shape}
              className={clsx(styles.iconBtn, isActive && styles.active)}
              onClick={() => handleShapeClick(shape)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title={t(`tool_${shape === 'x-box' ? 'star' : shape}`)}
            >
              {shape === 'star' && <Star size={16} />}
              {shape === 'cloud' && <Cloud size={16} />}
              {shape === 'heart' && <Heart size={16} />}
              {shape === 'oval' && <Circle size={16} />}
              {shape === 'trapezoid' && <TrapezoidIcon size={16} />}
              {shape === 'rhombus' && <Diamond size={16} />}
              {shape === 'x-box' && <X size={16} />}
            </button>
          );
        })}
      </div>

      {/* Row 3: Arrows and lines */}
      <div className={styles.styleGroup} style={{ justifyContent: 'space-between' }}>
        {['check-box', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow', 'line'].map((shape) => {
          const isActive = currentShapeOption === shape;
          return (
            <button
              key={shape}
              className={clsx(styles.iconBtn, isActive && styles.active)}
              onClick={() => handleShapeClick(shape)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title={t(`tool_${shape}`)}
            >
              {shape === 'check-box' && <Check size={16} />}
              {shape === 'arrow-up' && <ArrowBigUp size={16} />}
              {shape === 'arrow-down' && <ArrowBigDown size={16} />}
              {shape === 'arrow-left' && <ArrowBigLeft size={16} />}
              {shape === 'arrow-right' && <ArrowBigRight size={16} />}
              {shape === 'arrow' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
              {shape === 'line' && <Minus size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
