import styles from './Toolbar.module.css';
import { MousePointer2, Pencil, Type } from 'lucide-react';
import clsx from 'clsx';
import { UIPortal } from '../UIPortal';
import { useFileSystemStore } from '../../store/fileSystemStore';

interface ToolbarProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
}

export const Toolbar = ({ activeTool, onSelectTool }: ToolbarProps) => {
  const { leftHandedMode } = useFileSystemStore();

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
          title="Selection"
        >
          <MousePointer2 size={20} />
        </button>
        <button
          className={clsx(styles.button, activeTool === 'draw' && styles.active)}
          onClick={() => onSelectTool('draw')}
          title="Pencil"
        >
          <Pencil size={20} />
        </button>
        <button
          className={clsx(styles.button, activeTool === 'text' && styles.active)}
          onClick={() => onSelectTool('text')}
          title="Text"
        >
          <Type size={20} />
        </button>
      </div>
    </UIPortal>
  );
};
