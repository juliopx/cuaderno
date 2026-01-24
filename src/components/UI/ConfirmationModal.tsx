import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmationModal.module.css';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface ConfirmationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  children?: React.ReactNode;
}

export const ConfirmationModal = ({
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  children
}: ConfirmationModalProps) => {
  const { t } = useTranslation();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  return createPortal(
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {description && <p className={styles.description}>{description}</p>}

        {children && <div className={styles.content}>{children}</div>}

        <div className={styles.actions}>
          <button className={styles.secondary} onClick={onCancel}>
            {cancelLabel || t('cancel')}
          </button>
          <button
            ref={confirmRef}
            className={clsx(styles.primary, variant === 'danger' && styles.danger)}
            onClick={onConfirm}
          >
            {confirmLabel || t('confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
