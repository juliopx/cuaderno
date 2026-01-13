
import styles from './Toolbar.module.css';
import { MousePointer2, Pencil, Type } from 'lucide-react';
import clsx from 'clsx';
// We will bind this to Tldraw state later. For now, local state or store.

// Actually, UI state (active tool) might be better in the store or direct Tldraw binding.
// Let's assume we sync it via a hook. But for UI scaffolding, we use a local or store prop.

interface ToolbarProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
}

export const Toolbar = ({ activeTool, onSelectTool }: ToolbarProps) => {
  return (
    <div className={styles.toolbar} data-is-ui="true">
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
  );
};
