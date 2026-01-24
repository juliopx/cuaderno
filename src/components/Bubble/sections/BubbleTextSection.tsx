import clsx from 'clsx';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DefaultFontStyle, DefaultSizeStyle, DefaultColorStyle, DefaultTextAlignStyle } from 'tldraw';
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

interface BubbleTextSectionProps {
  richStats: RichStats;
  currentFont: string;
  currentSize: string;
  colorsMap: Record<string, string>;
  colors: string[];
  isEditingRichText: boolean;
  editingShape: any;
  hasMoved: React.MutableRefObject<boolean>;
  setStyle: (style: any, value: any) => void;
  toggleStyle: (command: string) => void;
  getStyle: (style: any, fallback: string) => any;
  openLinkModal: (e: React.MouseEvent) => void;
}

/**
 * Text settings section of the Bubble component.
 * Includes font, size, format buttons, alignment, and color selection.
 */
export const BubbleTextSection = ({
  richStats,
  currentFont,
  currentSize,
  colorsMap,
  colors,
  isEditingRichText,
  editingShape,
  hasMoved,
  setStyle,
  toggleStyle,
  getStyle,
  openLinkModal,
}: BubbleTextSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.textSettings}>
      <div className={styles.topRow}>
        <div className={styles.textToolsRow}>
          {['draw', 'sans', 'serif', 'mono'].map(f => (
            <button
              key={f}
              className={clsx(styles.iconBtnTiny, currentFont === f && styles.active)}
              style={{
                fontFamily: `var(--font-${f})`,
                fontSize: '16px',
                fontWeight: 'bold',
              }}
              onClick={() => setStyle(DefaultFontStyle, f)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title={t(`font_${f}`)}
            >
              A
            </button>
          ))}
          <div className={styles.verticalDivider} />
          {['xs', 's', 'm', 'l', 'xl', 'xxl'].map(s => (
            <button
              key={s}
              className={clsx(styles.iconBtnTiny, currentSize === s && styles.active)}
              style={{
                fontSize: s === 'xs' ? '10px' :
                  s === 's' ? '12px' :
                    s === 'm' ? '14px' :
                      s === 'l' ? '18px' :
                        s === 'xl' ? '22px' : '26px',
                fontWeight: 'bold',
              }}
              onClick={() => setStyle(DefaultSizeStyle, s)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              title={t(`font_size_${s}`)}
            >
              A
            </button>
          ))}
        </div>
      </div>
      <div className={styles.toolsRow}>
        <div className={styles.styleGroup}>
          <button
            className={clsx(styles.iconBtn, richStats.bold && styles.active)}
            onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('bold'); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title={t('format_bold')}
          >
            <Bold strokeWidth={2.5} size={16} />
          </button>
          <button
            className={clsx(styles.iconBtn, richStats.italic && styles.active)}
            onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('italic'); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title={t('format_italic')}
          >
            <Italic strokeWidth={2.5} size={16} />
          </button>
          <button
            className={clsx(styles.iconBtn, richStats.underline && styles.active)}
            onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('underline'); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title={t('format_underline')}
          >
            <Underline strokeWidth={2.5} size={16} />
          </button>
          <button
            className={clsx(styles.iconBtn, richStats.strike && styles.active)}
            onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('strikethrough'); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title={t('format_strikethrough')}
          >
            <Strikethrough strokeWidth={2.5} size={16} />
          </button>
          <div className={styles.verticalDivider} />
          <button
            className={styles.iconBtn}
            onClick={openLinkModal}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            title={t('format_link')}
          >
            <LinkIcon size={16} />
          </button>
          <div className={styles.verticalDivider} />
        </div>
        <div className={styles.styleGroup}>
          {['start', 'middle', 'end', 'justify'].filter(h => {
            if (h === 'justify') {
              const isAuto = (editingShape as any)?.props?.autoSize ?? true;
              return !isAuto;
            }
            return true;
          }).map((h) => {
            const isActive = isEditingRichText ? richStats.align === h : getStyle(DefaultTextAlignStyle, 'start') === h;
            return (
              <button
                key={h}
                className={clsx(styles.iconBtn, isActive && styles.active)}
                onClick={() => {
                  if (!hasMoved.current) {
                    setStyle(DefaultTextAlignStyle, h);
                  }
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                title={t(`align_${h === 'middle' ? 'middle' : (h === 'end' ? 'end' : h)}`)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="4" width="12" height="1.5" rx="0.75" />
                  <rect
                    x={h === 'start' ? 2 : (h === 'middle' ? 4 : (h === 'end' ? 6 : 2))}
                    y="7.25"
                    width={h === 'justify' ? 12 : 8} height="1.5" rx="0.75"
                  />
                  <rect
                    x={h === 'start' ? 2 : (h === 'middle' ? 3 : (h === 'end' ? 4 : 2))}
                    y="10.5"
                    width={h === 'justify' ? 12 : 10} height="1.5" rx="0.75"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.colorsRow}>
        {colors.map(c => (
          <button
            key={c}
            className={clsx(styles.colorSwatch, richStats.color === c && styles.activeColor)}
            style={{
              backgroundColor: colorsMap[c],
              boxShadow: richStats.color === c
                ? `0 0 0 2px var(--glass-bg), 0 0 0 4px ${colorsMap[c]}`
                : undefined
            }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => !hasMoved.current && setStyle(DefaultColorStyle, c)}
          />
        ))}
      </div>
    </div>
  );
};
