import styles from './Toolbar.module.css';
import { MousePointer2, Pencil, Type } from 'lucide-react';
import clsx from 'clsx';
import { UIPortal } from '../UIPortal';

interface ToolbarProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
}

export const Toolbar = ({ activeTool, onSelectTool }: ToolbarProps) => {
  return (
    <UIPortal>
      <div className={styles.toolbar} data-is-ui="true" style={{ pointerEvents: 'auto' }}>
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
