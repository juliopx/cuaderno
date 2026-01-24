import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { DefaultFillStyle } from 'tldraw';
import styles from '../Bubble.module.css';
import { FillColorStyle, FillOpacityStyle, StrokeOpacityStyle } from '../../../styles/customStyles';

interface BubbleFillSectionProps {
  currentFill: string;
  currentFillColor: string;
  currentFillOpacity: number;
  currentStrokeOpacity: number;
  colorsMap: Record<string, string>;
  colors: string[];
  hasMoved: React.MutableRefObject<boolean>;
  setStyle: (style: any, value: any) => void;
}

/**
 * Fill settings section of the Bubble component.
 * Includes fill toggle, color selection, and opacity slider.
 */
export const BubbleFillSection = ({
  currentFill,
  currentFillColor,
  currentFillOpacity,
  currentStrokeOpacity,
  colorsMap,
  colors,
  hasMoved,
  setStyle,
}: BubbleFillSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.fillSettings}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{t('style_fill')}</span>
        <button
          className={clsx(styles.switch, currentFill !== 'none' && styles.switchActive)}
          onClick={() => {
            if (currentFill === 'none') {
              setStyle(DefaultFillStyle, 'solid');
              // Reset opacity if it was 0
              if (currentFillOpacity === 0) setStyle(FillOpacityStyle, '1');
            } else {
              // Safety: if turning off fill, make sure stroke is on
              if (currentStrokeOpacity === 0) {
                setStyle(StrokeOpacityStyle, '1');
              }
              setStyle(DefaultFillStyle, 'none');
            }
          }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className={styles.switchHandle} />
        </button>
      </div>

      {currentFill !== 'none' && (
        <>
          <div className={styles.colorsRow}>
            {colors.map(c => (
              <button
                key={c}
                className={clsx(styles.colorSwatch, currentFillColor === c && styles.activeColor)}
                style={{
                  backgroundColor: colorsMap[c],
                  boxShadow: currentFillColor === c
                    ? `0 0 0 2px var(--glass-bg), 0 0 0 4px ${colorsMap[c]}`
                    : undefined
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => !hasMoved.current && setStyle(FillColorStyle, c)}
              />
            ))}
          </div>

          <div className={styles.opacityRow}>
            <input
              type="range"
              min="10"
              max="100"
              value={currentFillOpacity * 100}
              onChange={(e) => {
                const newOpacity = (parseInt(e.target.value) / 100).toString();
                setStyle(FillOpacityStyle, newOpacity);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={styles.opacitySlider}
            />
          </div>
        </>
      )}
    </div>
  );
};
