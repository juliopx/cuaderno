import { createPortal } from 'react-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Book, Folder as FolderIcon, File } from 'lucide-react';
import styles from './DeleteConfirmModal.module.css';
import { getSvgPathBoundingBox } from '../../lib/svgUtils';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemName: string;
  itemStrokes?: string;
  itemType: 'notebook' | 'folder' | 'page';
  itemCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal = ({ isOpen, itemName, itemStrokes, itemType, itemCount, onConfirm, onCancel }: DeleteConfirmModalProps) => {
  if (!isOpen) return null;


  const bbox = useMemo(() => {
    if (!itemStrokes) return null;
    return getSvgPathBoundingBox(itemStrokes);
  }, [itemStrokes]);

  const hasText = itemName && itemName.length > 0;

  let svgStyle = undefined;
  let viewBox = undefined;

  if (bbox && !bbox.isEmpty) {
    if (hasText) {
      // If we have text, we must mimic the sidebar layout (0-250 coordinate space)
      // We start from x=0 to preserve horizontal alignment relative to text.
      // We extend width to cover the full drawing (bbox.x + bbox.width).
      const fullWidth = bbox.x + bbox.width;
      const height = 40; // Sidebar items are fixed 40px height

      svgStyle = {
        width: `${fullWidth}px`,
        height: `${height}px`,
      };

      // We view from (0,0) to include the left whitespace relative to text start
      viewBox = `0 0 ${fullWidth} ${height}`;
    } else {
      // If no text (handwriting mainly), we crop tightly to the drawing to save space
      svgStyle = {
        width: `${bbox.width}px`,
        height: `${bbox.height}px`,
        minWidth: `${bbox.width}px`
      };

      viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
    }
  }


  let Icon = File;
  if (itemType === 'notebook') Icon = Book;
  if (itemType === 'folder') Icon = FolderIcon;

  const { t } = useTranslation(); // Need to add hook usage at top component level
  // Actually I need to add useTranslation import and hook usage first.
  // Let's do a multi-edit for the whole file or just the render part.
  const itemDescriptionKey = itemType === 'notebook' ? 'notebook' : itemType === 'folder' ? 'folder' : 'page';

  return createPortal(
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.message}>
          {t('delete_confirmation_message', { itemType: t(itemDescriptionKey) })}
          {itemCount && itemCount > 0 ? <span style={{ display: 'block', fontSize: '0.9em', opacity: 0.7, marginTop: '4px' }}>{t('contains_items', { count: itemCount })}</span> : null}
        </div>

        <div className={styles.itemReplica}>
          <Icon size={16} className={styles.icon} />
          <div className={styles.itemName}>
            <span className={styles.nameText}>{itemName}</span>
            {itemStrokes && (
              <div className={styles.strokeClip}>
                <svg
                  className={styles.nameStrokes}
                  viewBox={viewBox}
                  style={{
                    ...svgStyle,
                    position: 'absolute',
                    top: 0,
                    insetInlineStart: '0',
                    maxWidth: 'none'
                  }}
                >
                  <path d={itemStrokes} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className={styles.buttons}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {t('cancel')}
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            {t('delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
