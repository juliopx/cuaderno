
import styles from './Layout.module.css';
import { Sidebar } from './Sidebar/Sidebar';
import { CanvasArea } from './Canvas/CanvasArea';
import { Settings } from './Settings/Settings';
import { useEffect } from 'react';
import { useFileSystemStore } from '../store/fileSystemStore';
import clsx from 'clsx';

export const Layout = () => {
  const { load, theme, dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';
  // Added 'leftHandedMode'

  // Theme observer
  useEffect(() => {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      await load();
      const state = useFileSystemStore.getState(); // Changed to get state once
      const { notebooks, pages, selectPage } = state; // Destructured from state

      if (notebooks.length === 0) {
        // init logic // Simplified comment
      } else {
        // Only override if NO valid state was restored
        // (i.e. if activeNotebookId is null, it means we have no session restored)
        if (!state.activeNotebookId) {
          // If we have pages, select the most recent one to expand sidebar
          const pagesList = Object.values(pages).sort((a, b) => b.updatedAt - a.updatedAt);
          if (pagesList.length > 0) {
            selectPage(pagesList[0].id);
          } else {
            // Select first notebook
            useFileSystemStore.setState({ activeNotebookId: notebooks[0].id });
          }
        }
      }
    };
    init();
  }, [load]);




  return (
    <div className={clsx(styles.container, leftHandedMode && styles.containerLeftHanded)}>
      <Sidebar />
      <main className={styles.main}>
        <Settings /> {/* Added Settings component */}
        <CanvasArea />
      </main>
    </div>
  );
};
