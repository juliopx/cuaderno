import { useEditor, track } from 'tldraw';
import { useTranslation } from 'react-i18next';
import { Undo2, Redo2 } from 'lucide-react';
import { CircularButton } from '../UI/CircularButton';
import styles from './CanvasArea.module.css';
import clsx from 'clsx';

export const HistoryControls = track(({ sidebarColumns, leftHandedMode }: { sidebarColumns: number, leftHandedMode: boolean }) => {
  const editor = useEditor();
  const { t } = useTranslation();

  const canUndo = editor.getCanUndo();
  const canRedo = editor.getCanRedo();

  const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;

  return (
    <div
      className={styles.historyControls}
      style={{
        [leftHandedMode ? 'right' : 'left']: `calc(${sidebarWidth}px + 1rem)`,
        [leftHandedMode ? 'left' : 'right']: 'auto'
      } as React.CSSProperties}
    >
      <CircularButton
        onClick={() => editor.undo()}
        disabled={!canUndo}
        title={t('undo')}
        icon={<Undo2 size={20} />}
        className={clsx(styles.historyButton, !canUndo && styles.disabled)}
      />
      <CircularButton
        onClick={() => editor.redo()}
        disabled={!canRedo}
        title={t('redo')}
        icon={<Redo2 size={20} />}
        className={clsx(styles.historyButton, !canRedo && styles.disabled)}
      />
    </div>
  );
});
