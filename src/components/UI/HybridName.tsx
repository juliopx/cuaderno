import { useMemo } from 'react';
import styles from './HybridName.module.css';
import { getSvgPathBoundingBox } from '../../lib/svgUtils';
import { clsx } from 'clsx';

interface HybridNameProps {
  name: string;
  strokes?: string;
  color?: string; // Hex color
  className?: string;
  isRtl?: boolean;
  scale?: number;
  hideText?: boolean;
  scrollLeft?: number;
  isEditor?: boolean;
  width?: string | number;
  maxWidth?: string | number;
}

/**
 * Standardized component to render text with SVG pen strokes.
 * USES A 28px/80px REFERENCE SCALE FOR ABSOLUTE LINEAR PRECISION.
 */
export const HybridName = ({
  name,
  strokes,
  color,
  className,
  isRtl,
  scale = 1,
  hideText = false,
  scrollLeft = 0,
  isEditor = false,
  width,
  maxWidth
}: HybridNameProps) => {
  const bbox = useMemo(() => {
    if (!strokes) return null;
    return getSvgPathBoundingBox(strokes);
  }, [strokes]);

  // Width calculation: we ensure at least 250px or the extent of the drawing
  const drawingWidth = (bbox && !bbox.isEmpty) ? bbox.x + bbox.width : 0;
  const svgWidth = Math.max(250, drawingWidth);
  const viewBox = `0 0 ${svgWidth} 40`;

  // Vertical normalization: everything is based on an 80px high reference
  const referenceScale = 2;
  const visualAdjustment = scale / referenceScale;

  // LAYOUT ARCHITECTURE:
  // We ALWAYS render text at 28px/80px (Reference Base) and scale the CONTAINER.
  // This ensures text metrics are identical across ALL modes, solving linear drift.
  // In standard UI, we use a "Ghost" span at 14px for accurate layout spacing.

  const innerStyle: React.CSSProperties = {
    transform: `scale(${visualAdjustment})`,
    transformOrigin: '0 0',
    width: 'max-content',
    minWidth: isEditor ? '1000px' : undefined,
    height: 80,
    display: 'block',
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    overflow: 'visible'
  };

  const scrollWrapperStyle: React.CSSProperties = {
    transform: isEditor ? `translateX(${-scrollLeft / visualAdjustment}px)` : undefined,
    display: 'block',
    width: 'max-content',
    height: '100%',
    position: 'relative',
    overflow: 'visible'
  };

  const textStyle: React.CSSProperties = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    fontSize: '28px',
    fontWeight: 400,
    letterSpacing: '0',
    lineHeight: '80px',
    whiteSpace: 'pre',
    textRendering: 'geometricPrecision',
    fontVariantLigatures: 'none',
    fontKerning: 'none',
    pointerEvents: 'none',
    visibility: hideText ? 'hidden' : 'visible'
  };

  const ghostStyle: React.CSSProperties = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    fontSize: `${14 * scale}px`,
    fontWeight: 400,
    letterSpacing: '0',
    lineHeight: `${40 * scale}px`,
    whiteSpace: 'pre',
    visibility: 'hidden',
    pointerEvents: 'none',
    display: 'inline-block'
  };

  // Horizontal normalization for stroke-only elements (standard mode only)
  const horizontalShift = (!isEditor && !name && strokes && bbox) ? -bbox.x : 0;

  // Calculate the visual footprint of the strokes in UI pixels (accounting for shift)
  const strokesRightBoundary = (bbox && !bbox.isEmpty) ? (bbox.x + bbox.width + horizontalShift) * scale : 0;

  return (
    <div
      className={clsx(styles.container, className, isEditor && styles.editor)}
      style={{
        height: 40 * scale,
        ...(color ? { color } : {}),
        width: width || (isEditor ? '100%' : 'auto'),
        maxWidth,
        minWidth: (!isEditor && !width) ? Math.max(0, strokesRightBoundary) : undefined,
        overflow: 'hidden'
      }}
    >
      {/* Ghost for layout (Standard Mode only) */}
      {!isEditor && name && (
        <span style={ghostStyle}>{name}</span>
      )}

      <div style={innerStyle}>
        <div style={scrollWrapperStyle}>
          <span className={clsx(styles.nameText, styles.editorText)} style={textStyle}>{name}</span>
          {strokes && (
            <div className={styles.strokeOverlay}>
              <svg
                viewBox={viewBox}
                width={svgWidth}
                height={40}
                className={styles.svg}
                style={{
                  transform: 'scale(2)',
                  transformOrigin: '0 0',
                  color: 'inherit'
                }}
              >
                <path
                  d={strokes}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  transform={isRtl ? `translate(${svgWidth - drawingWidth + horizontalShift}, 0)` : (horizontalShift ? `translate(${horizontalShift}, 0)` : undefined)}
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
