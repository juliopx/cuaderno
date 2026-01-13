
import styles from './Layout.module.css';
import { Sidebar } from './Sidebar/Sidebar';
import { CanvasArea } from './Canvas/CanvasArea';
import { Settings } from './Settings/Settings';
import { useEffect } from 'react';
import { useFileSystemStore } from '../store/fileSystemStore';
import { CanvasTitle } from './Canvas/CanvasTitle';

export const Layout = () => {
  const { load, theme } = useFileSystemStore(); // Added 'theme'

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

  useEffect(() => {
    const checkParams = async () => {
      await new Promise(r => setTimeout(r, 200)); // Wait for OPFS/init
      const state = useFileSystemStore.getState(); // Changed to get state once
      const { notebooks, createNotebook, createPage, selectPage } = state; // Destructured from state
      if (notebooks.length === 0) {
        const nbName = "My First Notebook";
        // Removed comment about getting ID
        createNotebook(nbName);
        // Wait a bit and select if possible
        setTimeout(() => {
          const s = useFileSystemStore.getState(); // Changed variable name
          if (s.notebooks.length > 0) {
            const nbId = s.notebooks[0].id;
            createPage("First Page", nbId, nbId);
            setTimeout(() => {
              const fs = useFileSystemStore.getState(); // Changed variable name
              const pageId = Object.keys(fs.pages)[0];
              if (pageId) selectPage(pageId);
            }, 100);
          }
        }, 100);
      }
    };
    checkParams();
  }, []);


  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.main}>
        <CanvasTitle />
        <Settings /> {/* Added Settings component */}
        <CanvasArea />
      </main>
    </div>
  );
};
