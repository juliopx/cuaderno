import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './LinkInputModal.module.css';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';

interface LinkInputModalProps {
  onConfirm: (url: string) => void;
  onUpload: (files: File[]) => void;
  onCancel: () => void;
  title?: string;
}

export const LinkInputModal = ({ onConfirm, onUpload, onCancel, title }: LinkInputModalProps) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  const handleConfirm = () => {
    if (url.trim()) {
      onConfirm(url.trim());
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onUpload(files);
      onCancel(); // Close modal after selection
    }
  };

  return createPortal(
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{title || t('tool_image')}</h3>

        <button
          className={styles.uploadBtn}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={20} />
          {t('upload_from_device')}
        </button>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          multiple
          accept="image/*"
          onChange={handleFileChange}
        />

        <div className={styles.divider}>
          <span>{t('or_paste_url')}</span>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('url_placeholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
        />
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={onCancel}>{t('cancel')}</button>
          <button className={styles.primary} onClick={handleConfirm}>{t('confirm')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
