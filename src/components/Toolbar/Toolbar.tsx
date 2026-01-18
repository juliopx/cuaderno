import styles from './Toolbar.module.css';
import { MousePointer2, Pencil, Eraser, Type, ImagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { UIPortal } from '../UIPortal';
import { useFileSystemStore } from '../../store/fileSystemStore';
import { useState } from 'react';
import { LinkInputModal } from '../UI/LinkInputModal';

interface ToolbarProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
  onUpload?: (files: File[]) => void;
  onAddUrl?: (url: string) => void;
}

export const Toolbar = ({ activeTool, onSelectTool, onUpload, onAddUrl }: ToolbarProps) => {
  const { t } = useTranslation();
  const { dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const handleUrlConfirm = (url: string) => {
    if (onAddUrl) {
      onAddUrl(url);
    }
    setIsMediaModalOpen(false);
  };

  const handleUpload = (files: File[]) => {
    if (onUpload) {
      onUpload(files);
    }
    setIsMediaModalOpen(false);
  };

  return (
    <UIPortal>
      <div
        className={styles.toolbar}
        data-is-ui="true"
        style={{
          pointerEvents: 'auto',
          '--toolbar-right': leftHandedMode ? 'auto' : '1rem',
          '--toolbar-left': leftHandedMode ? '1rem' : 'auto',
        } as React.CSSProperties}
      >
        <button
          className={clsx(styles.button, activeTool === 'select' && styles.active)}
          onClick={() => onSelectTool('select')}
          title={t('tool_selection')}
        >
          <MousePointer2 size={20} />
        </button>
        <button
          className={clsx(styles.button, activeTool === 'draw' && styles.active)}
          onClick={() => onSelectTool('draw')}
          title={t('tool_pencil')}
        >
          <Pencil size={20} />
        </button>
        <button
          className={clsx(styles.button, activeTool === 'eraser' && styles.active)}
          onClick={() => onSelectTool('eraser')}
          title={t('tool_eraser')}
        >
          <Eraser size={20} />
        </button>
        <button
          className={clsx(styles.button, activeTool === 'text' && styles.active)}
          onClick={() => onSelectTool('text')}
          title={t('tool_text')}
        >
          <Type size={20} />
        </button>

        {activeTool === 'select' && (
          <>
            <div className={styles.divider} />
            <button
              className={styles.button}
              onClick={() => setIsMediaModalOpen(true)}
              title={t('tool_image')}
            >
              <ImagePlus size={20} />
            </button>
          </>
        )}
      </div>

      {isMediaModalOpen && (
        <LinkInputModal
          onConfirm={handleUrlConfirm}
          onUpload={handleUpload}
          onCancel={() => setIsMediaModalOpen(false)}
        />
      )}
    </UIPortal>
  );
};
