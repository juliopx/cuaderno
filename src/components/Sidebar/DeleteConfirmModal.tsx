import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Book, Folder as FolderIcon, File } from 'lucide-react';
import styles from './DeleteConfirmModal.module.css';
import { HybridName } from '../UI/HybridName';

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
  const { t } = useTranslation();
  if (!isOpen) return null;

  let Icon = File;
  if (itemType === 'notebook') Icon = Book;
  if (itemType === 'folder') Icon = FolderIcon;

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
          <HybridName
            name={itemName}
            strokes={itemStrokes}
            className={styles.itemName}
          />
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
