import { useState, useRef } from 'react';
import { MousePointer2, Pencil, Eraser, Type, ImagePlus, Shapes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from '../Bubble.module.css';
import { LinkInputModal } from '../../UI/LinkInputModal';

interface BubbleToolbarSectionProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
  onUpload?: (files: File[]) => void;
  onAddUrl?: (url: string) => void;
  hasMoved: React.MutableRefObject<boolean>;
  onCollapse: (e: React.MouseEvent) => void;
}

/**
 * Horizontal toolbar section displayed at the top of the Bubble.
 * Contains tool selection buttons (select, draw, eraser, text, shapes, image).
 */
export const BubbleToolbarSection = ({
  activeTool,
  onSelectTool,
  onUpload,
  onAddUrl,
  hasMoved,
  onCollapse,
}: BubbleToolbarSectionProps) => {
  const { t } = useTranslation();
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const lastClickTime = useRef(0);

  const handleUrlConfirm = (url: string) => {
    if (onAddUrl) {
      onAddUrl(url);
    }
    onSelectTool('select');
    setIsMediaModalOpen(false);
  };

  const handleUpload = (files: File[]) => {
    if (onUpload) {
      onUpload(files);
    }
    onSelectTool('select');
    setIsMediaModalOpen(false);
  };

  const handleToolClick = (tool: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMoved.current) return;

    // Select tool on every click
    onSelectTool(tool);

    const now = Date.now();
    if (now - lastClickTime.current < 200) {
      onCollapse(e);
    }
    lastClickTime.current = now;
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMoved.current) return;

    const now = Date.now();
    if (now - lastClickTime.current < 200) {
      onCollapse(e);
    } else {
      setIsMediaModalOpen(true);
    }
    lastClickTime.current = now;
  };

  return (
    <>
      <div className={styles.toolbarSection}>
        <button
          className={clsx(styles.toolButton, activeTool === 'select' && styles.active)}
          onClick={handleToolClick('select')}
          title={t('tool_selection')}
        >
          <MousePointer2 size={22} />
        </button>
        <button
          className={clsx(styles.toolButton, activeTool === 'draw' && styles.active)}
          onClick={handleToolClick('draw')}
          title={t('tool_pencil')}
        >
          <Pencil size={22} />
        </button>
        <button
          className={clsx(styles.toolButton, activeTool === 'eraser' && styles.active)}
          onClick={handleToolClick('eraser')}
          title={t('tool_eraser')}
        >
          <Eraser size={22} />
        </button>
        <button
          className={clsx(styles.toolButton, activeTool === 'text' && styles.active)}
          onClick={handleToolClick('text')}
          title={t('tool_text')}
        >
          <Type size={22} />
        </button>
        <button
          className={clsx(styles.toolButton, (activeTool === 'shapes' || activeTool === 'geo' || activeTool === 'arrow' || activeTool === 'line') && styles.active)}
          onClick={handleToolClick('shapes')}
          title={t('tool_shapes')}
        >
          <Shapes size={22} />
        </button>

        <div className={styles.toolbarDivider} />

        <button
          className={clsx(styles.toolButton, isMediaModalOpen && styles.active)}
          onClick={handleImageClick}
          title={t('tool_image')}
        >
          <ImagePlus size={22} />
        </button>
      </div>

      {isMediaModalOpen && (
        <LinkInputModal
          onConfirm={handleUrlConfirm}
          onUpload={handleUpload}
          onCancel={() => setIsMediaModalOpen(false)}
        />
      )}
    </>
  );
};
