import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { DefaultDashStyle, DefaultSizeStyle, DefaultColorStyle, DefaultFillStyle } from 'tldraw';
import styles from '../Bubble.module.css';
import { ScribbleIcon } from '../icons';
import { FillOpacityStyle, StrokeOpacityStyle } from '../../../styles/customStyles';

interface BubbleStrokeSectionProps {
  activeTool: string;
  isSelectTool: boolean;
  isAllDraw: boolean;
  currentDash: string;
  currentSize: string;
  currentColor: string;
  currentStrokeOpacity: number;
  currentFill: string;
  currentFillOpacity: number;
  colorsMap: Record<string, string>;
  colors: string[];
  hasMoved: React.MutableRefObject<boolean>;
  setStyle: (style: any, value: any) => void;
}

/**
 * Stroke settings section of the Bubble component.
 * Includes dash style, size, color, and opacity controls.
 */
export const BubbleStrokeSection = ({
  activeTool,
  isSelectTool,
  isAllDraw,
  currentDash,
  currentSize,
  currentColor,
  currentStrokeOpacity,
  currentFill,
  currentFillOpacity,
  colorsMap,
  colors,
  hasMoved,
  setStyle,
}: BubbleStrokeSectionProps) => {
  const { t } = useTranslation();

  const isDrawMode = activeTool === 'draw' || (isSelectTool && isAllDraw);
  const showHeader = !isDrawMode;

  return (
    <div className={styles.strokeSettings}>
      {showHeader && (
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{t('style_stroke')}</span>
          <button
            className={clsx(styles.switch, currentStrokeOpacity > 0 && styles.switchActive)}
            onClick={() => {
              const newOpacity = currentStrokeOpacity > 0 ? '0' : '1';
              // Safety: Don't allow both off. If turning off stroke, turn on fill.
              if (newOpacity === '0' && currentFill === 'none') {
                setStyle(DefaultFillStyle, 'solid');
                if (currentFillOpacity === 0) setStyle(FillOpacityStyle, '1');
              }
              setStyle(StrokeOpacityStyle, newOpacity);
            }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <div className={styles.switchHandle} />
          </button>
        </div>
      )}

      {currentStrokeOpacity > 0 && (
        <>
          <div className={styles.sizeRow}>
            {/* Dash Style */}
            <div className={styles.styleGroup}>
              {['draw', 'solid', 'dashed', 'dotted'].map((dash) => {
                const isActive = currentDash === dash;
                return (
                  <button
                    key={dash}
                    className={clsx(styles.iconBtnCompact, isActive && styles.active)}
                    onClick={() => {
                      if (!hasMoved.current) {
                        setStyle(DefaultDashStyle, dash);
                      }
                    }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    title={t(`style_border_${dash}`)}
                  >
                    {dash === 'draw' ? (
                      <ScribbleIcon strokeWidth={2} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        {dash === 'solid' && <line x1="2" y1="10" x2="18" y2="10" />}
                        {dash === 'dashed' && <line x1="2" y1="10" x2="18" y2="10" strokeDasharray="4 2" />}
                        {dash === 'dotted' && <line x1="2" y1="10" x2="18" y2="10" strokeDasharray="1 2" />}
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <>
              <div className={styles.verticalDivider} />
              <div className={styles.styleGroup} style={{ flex: 1, justifyContent: 'space-between' }}>
                {(isDrawMode ? ['xs', 's', 'm', 'l', 'xl', 'xxl'] : ['s', 'm', 'l', 'xl']).map((sz) => {
                  const strokeWidths: Record<string, number> = { xs: 1, s: 1.5, m: 2.5, l: 4, xl: 6, xxl: 10 };
                  return (
                    <button
                      key={sz}
                      className={clsx(styles.sizeBtnCompact, currentSize === sz && styles.active)}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={() => !hasMoved.current && setStyle(DefaultSizeStyle, sz)}
                    >
                      <ScribbleIcon strokeWidth={strokeWidths[sz]} />
                    </button>
                  );
                })}
              </div>
            </>
          </div>

          <div className={styles.colorsRow}>
            {colors.map(c => (
              <button
                key={c}
                className={clsx(styles.colorSwatch, currentColor === c && styles.activeColor)}
                style={{
                  backgroundColor: colorsMap[c],
                  boxShadow: currentColor === c
                    ? `0 0 0 2px var(--glass-bg), 0 0 0 4px ${colorsMap[c]}`
                    : undefined
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => !hasMoved.current && setStyle(DefaultColorStyle, c)}
              />
            ))}
          </div>

          {!isDrawMode && (
            <div className={styles.opacityRow}>
              <input
                type="range"
                min="10"
                max="100"
                value={currentStrokeOpacity * 100}
                onChange={(e) => {
                  const newOpacity = (parseInt(e.target.value) / 100).toString();
                  setStyle(StrokeOpacityStyle, newOpacity);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={styles.opacitySlider}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
