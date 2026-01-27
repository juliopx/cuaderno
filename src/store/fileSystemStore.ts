
import { create } from 'zustand';
import type { Notebook, Folder, Page } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { opfs } from '../lib/opfs';
import { useSyncStore } from './syncStore';
import { diskLog, syncLog } from '../lib/debugLog';
import i18n from '../i18n';

const METADATA_FILE = 'metadata.json';


interface FileSystemState {
  notebooks: Notebook[];
  folders: Record<string, Folder>; // Keyed by ID
  pages: Record<string, Page>; // Keyed by ID

  activeNotebookId: string | null;
  activePath: string[]; // Array of IDs starting from notebook -> folder -> subfolder
  activePageId: string | null;
  activeStateUpdatedAt: number;
  activeStateModifier: string;
  isSidebarOpen: boolean;
  theme: 'auto' | 'light' | 'dark';
  dominantHand: 'right' | 'left';
  penMode: boolean;
  language: 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko' | 'ar' | 'ca' | 'gl' | 'eu' | 'ru' | 'it' | 'nl' | 'sv' | 'pl' | 'tr';
  deletedItemIds: string[]; // Tombstones for sync
  lastSelfPushedVersions: Record<string, number>; // { pageId: version }

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'auto' | 'light' | 'dark') => void;
  setDominantHand: (hand: 'right' | 'left') => void;
  setPenMode: (enabled: boolean) => void;
  setLanguage: (lang: 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko' | 'ar' | 'ca' | 'gl' | 'eu' | 'ru' | 'it' | 'nl' | 'sv' | 'pl' | 'tr') => void;

  createNotebook: (name: string) => void;
  createFolder: (name: string, parentId: string, notebookId: string) => void;
  createPage: (name: string, parentId: string, notebookId: string) => void;

  setActiveNotebook: (id: string) => void;
  navigatePath: (path: string[]) => void;
  openFolder: (id: string) => void; // Adds to path
  closeFolder: (id: string) => void; // Removes from path (and children)
  selectPage: (id: string) => void;
  renameNode: (id: string, name: string, strokes?: string, color?: string) => void;

  deleteNotebook: (id: string) => void;
  deleteFolder: (id: string) => void;
  deletePage: (id: string) => void;

  duplicateNotebook: (id: string) => void;
  duplicateFolder: (id: string, parentId?: string | null, notebookId?: string) => void;
  duplicatePage: (id: string, parentId?: string | null, notebookId?: string) => void;

  importNotebook: (data: any) => void;
  importFolder: (data: any, parentId?: string | null, notebookId?: string) => void;
  importPage: (data: any, parentId?: string | null, notebookId?: string) => void;


  // Persistence
  load: () => Promise<void>;
  save: () => Promise<void>;
  reorderNotebooks: (activeId: string, overId: string) => void;
  moveNode: (activeId: string, overId: string, isContainer?: boolean) => void;
  markPageDirty: (pageId: string) => void;

  // Sync helpers
  clearDirtyFlags: () => void;
  mergeRemoteData: (remoteData: any) => void;

  // New: Force save mechanism for sync
  forceSaveActivePage: (() => Promise<void>) | null;
  registerActivePageSaver: (saver: () => Promise<void>) => void;
  recordSelfPush: (pageId: string, version: number) => void;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  notebooks: [],
  folders: {},
  pages: {},
  deletedItemIds: [],
  lastSelfPushedVersions: {},

  activeNotebookId: null,
  activePath: [],
  activePageId: null,
  activeStateUpdatedAt: 0,
  activeStateModifier: '',
  isSidebarOpen: true,
  theme: (localStorage.getItem('cuaderno-theme') as any) || 'auto',
  dominantHand: (localStorage.getItem('cuaderno-dominant-hand') as any) ||
    (localStorage.getItem('cuaderno-left-handed') === 'true' ? 'left' : 'right'),
  penMode: localStorage.getItem('cuaderno-pen-mode') === 'true',
  language: (localStorage.getItem('i18nextLng') as any) || 'en',

  forceSaveActivePage: null,
  registerActivePageSaver: (saver) => set({ forceSaveActivePage: saver }),
  recordSelfPush: (pageId, version) => {
    set(state => ({
      lastSelfPushedVersions: {
        ...state.lastSelfPushedVersions,
        [pageId]: version
      }
    }));
  },

  toggleSidebar: () => {
    const newState = !useFileSystemStore.getState().isSidebarOpen;
    diskLog(`💾 [FileSystem] ${newState ? 'Opened' : 'Closed'} sidebar`);
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },
  setTheme: (theme) => {
    diskLog(`💾 [FileSystem] Changed theme to "${theme}"`);
    localStorage.setItem('cuaderno-theme', theme);
    set({ theme });
  },
  setDominantHand: (hand) => {
    diskLog(`💾 [FileSystem] Changed dominant hand to "${hand}"`);
    localStorage.setItem('cuaderno-dominant-hand', hand);
    set({ dominantHand: hand });
  },
  setPenMode: (enabled) => {
    diskLog(`💾 [FileSystem] Changed pen mode to "${enabled}"`);
    localStorage.setItem('cuaderno-pen-mode', String(enabled));
    set({ penMode: enabled });
  },
  setLanguage: (lang) => {
    diskLog(`💾 [FileSystem] Changed language to "${lang}"`);
    set({ language: lang });
    import('../i18n').then(m => m.default.changeLanguage(lang));
  },


  createNotebook: (name) => {
    const clientId = useSyncStore.getState().clientId;
    const maxOrder = get().notebooks.length > 0 ? Math.max(...get().notebooks.map(n => n.order || 0)) : 0;
    const newNotebook: Notebook = {
      id: uuidv4(),
      name,
      createdAt: Date.now(),
      order: maxOrder + 10000,
      version: 1,
      dirty: true,
      lastModifier: clientId,
    };
    syncLog(`🔶 [FileSystem] Created notebook "${name}" (${newNotebook.id}) - dirty`);
    set((state) => ({ notebooks: [...state.notebooks, newNotebook].sort((a, b) => (a.order || 0) - (b.order || 0)) }));
    get().setActiveNotebook(newNotebook.id);
    setTimeout(() => get().save(), 0);
  },

  createFolder: (name, parentId, notebookId) => {
    const clientId = useSyncStore.getState().clientId;
    set((state) => {
      // Calculate max order for siblings
      const siblings = Object.values(state.folders).filter(f => f.parentId === parentId)
        .concat(Object.values(state.pages).filter(p => p.parentId === parentId) as any[]);

      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s: any) => s.order || 0)) : 0;

      const newFolder: Folder = {
        id: uuidv4(),
        name,
        parentId,
        notebookId,
        createdAt: Date.now(),
        order: maxOrder + 10000, // Add at end with gap
        version: 1,
        dirty: true,
        lastModifier: clientId,
      };

      syncLog(`🔶 [FileSystem] Created folder "${name}" (${newFolder.id}) - dirty`);
      setTimeout(() => {
        get().openFolder(newFolder.id);
        get().save();
      }, 0);
      return { folders: { ...state.folders, [newFolder.id]: newFolder } };
    });
  },

  createPage: (name, parentId, notebookId) => {
    const clientId = useSyncStore.getState().clientId;
    set((state) => {
      const siblings = Object.values(state.folders).filter(f => f.parentId === parentId)
        .concat(Object.values(state.pages).filter(p => p.parentId === parentId) as any[]);

      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s: any) => s.order || 0)) : 0;

      const newPage: Page = {
        id: uuidv4(),
        name,
        parentId,
        notebookId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: maxOrder + 10000, // Add at end
        version: 1,
        dirty: true,
        lastModifier: clientId,
      };
      syncLog(`🔶 [FileSystem] Created page "${name}" (${newPage.id}) - dirty`);

      // Initialize OPFS file with empty object to ensure sync finds it
      opfs.saveFile(`page-${newPage.id}.tldr`, '{}');

      const nextState = { pages: { ...state.pages, [newPage.id]: newPage } };
      // Trigger save and select
      setTimeout(() => {
        get().selectPage(newPage.id);
        get().save();
      }, 0);
      return nextState;
    });
  },

  navigatePath: (path: string[]) => {
    const clientId = useSyncStore.getState().clientId;
    diskLog(`💾 [FileSystem] Navigated to path:`, path);
    set({
      activePath: path,
      activePageId: null,
      activeStateUpdatedAt: Date.now(),
      activeStateModifier: clientId
    });
    setTimeout(() => get().save(), 0);
  },

  setActiveNotebook: (id: string) => {
    const state = get();
    const clientId = useSyncStore.getState().clientId;
    const notebook = state.notebooks.find(n => n.id === id);
    diskLog(`💾 [FileSystem] Selected notebook "${notebook?.name || 'Unknown'}" (${id})`);
    set({
      activeNotebookId: id,
      activePath: [],
      activePageId: null,
      activeStateUpdatedAt: Date.now(),
      activeStateModifier: clientId
    });
    setTimeout(() => get().save(), 0);
  },

  openFolder: (id) => set((state) => {
    const folder = state.folders[id];
    diskLog(`💾 [FileSystem] Opened folder "${folder?.name || 'Unknown'}" (${id})`);
    return { activePath: [...state.activePath, id] };
  }),
  closeFolder: (id) => set((state) => {
    const folder = state.folders[id];
    diskLog(`💾 [FileSystem] Closed folder "${folder?.name || 'Unknown'}" (${id})`);
    return { activePath: state.activePath.filter(pathId => pathId !== id) };
  }), // Simplified, might need more robust logic to remove *subsequent* folders too if in a column view

  selectPage: (id) => {
    const state = get();
    const page = state.pages[id];
    if (!page) return;

    const path: string[] = [];
    let currentParentId: string | null = page.parentId;
    const notebookId: string = page.notebookId;

    if (!notebookId) return;

    // Build the folder path (reversed)
    while (currentParentId && currentParentId !== notebookId) {
      const folder: Folder = state.folders[currentParentId];
      if (!folder) break;
      path.unshift(folder.id);
      currentParentId = folder.parentId || null;
    }

    const clientId = useSyncStore.getState().clientId;
    set({
      activePageId: id,
      activeNotebookId: notebookId,
      activePath: path, // Array of folder IDs
      activeStateUpdatedAt: Date.now(),
      activeStateModifier: clientId
    });
    diskLog(`💾 [FileSystem] Selected page "${page.name}" (${id})`);
    setTimeout(() => get().save(), 0);
  },


  renameNode: (id, name, strokes, color) => {
    const clientId = useSyncStore.getState().clientId;
    set((state) => {
      const notebooks = [...state.notebooks];
      const folders = { ...state.folders };
      const pages = { ...state.pages };

      const nbIdx = notebooks.findIndex(n => n.id === id);
      if (nbIdx !== -1) {
        notebooks[nbIdx] = {
          ...notebooks[nbIdx],
          name,
          nameStrokes: strokes,
          // Only update color if provided (undefined means no change, but 'auto' is a valid change)
          ...(color !== undefined ? { color } : {}),
          dirty: true,
          lastModifier: clientId
        };
      }

      if (folders[id]) {
        folders[id] = {
          ...folders[id],
          name,
          nameStrokes: strokes,
          ...(color !== undefined ? { color } : {}),
          dirty: true,
          lastModifier: clientId
        };
      }
      if (pages[id]) {
        pages[id] = {
          ...pages[id],
          name,
          nameStrokes: strokes,
          ...(color !== undefined ? { color } : {}),
          dirty: true,
          lastModifier: clientId
        };
      }

      const nextState = { notebooks, folders, pages };

      // Log what was renamed
      if (nbIdx !== -1) {
        syncLog(`🔶 [FileSystem] Renamed notebook "${name}" (${id}) - dirty`);
      } else if (folders[id]) {
        syncLog(`🔶 [FileSystem] Renamed folder "${name}" (${id}) - dirty`);
      } else if (pages[id]) {
        syncLog(`🔶 [FileSystem] Renamed page "${name}" (${id}) - dirty`);
      }

      setTimeout(() => get().save(), 0);
      return nextState;
    });
  },

  deleteNotebook: (id) => {
    set((state) => {
      const notebooks = state.notebooks.filter(n => n.id !== id);
      const folders = { ...state.folders };
      const pages = { ...state.pages };

      // Recursive delete: find all folders and pages belonging to this notebook
      const deletedIds: string[] = [id]; // Start with notebook ID

      Object.keys(folders).forEach(fid => {
        if (folders[fid].notebookId === id) {
          delete folders[fid];
          deletedIds.push(fid);
        }
      });
      Object.keys(pages).forEach(pid => {
        if (pages[pid].notebookId === id) {
          delete pages[pid];
          deletedIds.push(pid);
        }
      });

      const activeNotebookId = state.activeNotebookId === id ? null : state.activeNotebookId;
      const activePath = state.activeNotebookId === id ? [] : state.activePath;
      const activePageId = (state.activePageId && !pages[state.activePageId]) ? null : state.activePageId;

      // Add to tombstones
      const deletedItemIds = [...(state.deletedItemIds || []), ...deletedIds];

      syncLog(`☁️ [FileSystem] Deleted notebook (${id}) and ${deletedIds.length - 1} child items. Total tombstones: ${deletedItemIds.length}`);
      setTimeout(() => get().save(), 0);
      return { notebooks, folders, pages, activeNotebookId, activePath, activePageId, deletedItemIds };
    });
  },

  deleteFolder: (id) => {
    set((state) => {
      const folders = { ...state.folders };
      const pages = { ...state.pages };

      const deletedIds: string[] = [id]; // Start with folder ID

      const deleteRecursive = (folderId: string) => {
        // Delete pages in this folder
        Object.keys(pages).forEach(pid => {
          if (pages[pid].parentId === folderId) {
            delete pages[pid];
            deletedIds.push(pid);
          }
        });
        // Find subfolders
        Object.keys(folders).forEach(fid => {
          if (folders[fid].parentId === folderId) {
            deleteRecursive(fid);
            // Folder ID added below when deleted
          }
        });
        delete folders[folderId];
        // Ensure folder itself is added if not root call (root call added at top)
        if (folderId !== id) deletedIds.push(folderId);
      };

      deleteRecursive(id);

      // If active path contains this folder or its children, truncate it
      const folderIdx = state.activePath.indexOf(id);
      const activePath = folderIdx !== -1 ? state.activePath.slice(0, folderIdx) : state.activePath;
      const activePageId = (state.activePageId && !pages[state.activePageId]) ? null : state.activePageId;

      // Add to tombstones
      const deletedItemIds = [...(state.deletedItemIds || []), ...deletedIds];

      syncLog(`☁️ [FileSystem] Deleted folder (${id}) and ${deletedIds.length - 1} child items. Total tombstones: ${deletedItemIds.length}`);
      setTimeout(() => get().save(), 0);
      return { folders, pages, activePath, activePageId, deletedItemIds };
    });
  },

  deletePage: (id) => {
    set((state) => {
      const pages = { ...state.pages };
      delete pages[id];
      const activePageId = state.activePageId === id ? null : state.activePageId;

      const deletedItemIds = [...(state.deletedItemIds || []), id];

      syncLog(`☁️ [FileSystem] Deleted page (${id}). Total tombstones: ${deletedItemIds.length}`);
      setTimeout(() => get().save(), 0);
      return { pages, activePageId, deletedItemIds };
    });
  },

  duplicateNotebook: (id) => {
    const state = get();
    const notebook = state.notebooks.find(n => n.id === id);
    if (!notebook) return;

    const clientId = useSyncStore.getState().clientId;
    const maxOrder = state.notebooks.length > 0 ? Math.max(...state.notebooks.map(n => n.order || 0)) : 0;
    const newNotebookId = uuidv4();
    const newNotebook: Notebook = {
      ...notebook,
      id: newNotebookId,
      name: notebook.name,
      createdAt: Date.now(),
      order: maxOrder + 10000,
      version: 1,
      dirty: true,
      lastModifier: clientId,
    };

    set(state => ({
      notebooks: [...state.notebooks, newNotebook].sort((a, b) => (a.order || 0) - (b.order || 0))
    }));

    // Duplicate all top-level items in this notebook
    Object.values(state.folders).forEach(f => {
      if (f.notebookId === id && f.parentId === id) {
        get().duplicateFolder(f.id, newNotebookId, newNotebookId);
      }
    });
    Object.values(state.pages).forEach(p => {
      if (p.notebookId === id && p.parentId === id) {
        get().duplicatePage(p.id, newNotebookId, newNotebookId);
      }
    });

    setTimeout(() => get().save(), 0);
  },

  duplicateFolder: (id, parentId, notebookId) => {
    const state = get();
    const folder = state.folders[id];
    if (!folder) return;

    const clientId = useSyncStore.getState().clientId;
    const targetParentId = parentId || folder.parentId;
    const targetNotebookId = notebookId || folder.notebookId;

    // Calculate order
    const siblings = [
      ...Object.values(state.folders).filter(f => f.parentId === targetParentId),
      ...Object.values(state.pages).filter(p => p.parentId === targetParentId)
    ];
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) : 0;

    const newFolderId = uuidv4();
    const newFolder: Folder = {
      ...folder,
      id: newFolderId,
      name: folder.name,
      parentId: targetParentId,
      notebookId: targetNotebookId,
      createdAt: Date.now(),
      order: maxOrder + 10000,
      version: 1,
      dirty: true,
      lastModifier: clientId,
    };

    set(state => ({
      folders: { ...state.folders, [newFolderId]: newFolder }
    }));

    // Duplicate children
    Object.values(state.folders).forEach(f => {
      if (f.parentId === id) {
        get().duplicateFolder(f.id, newFolderId, targetNotebookId);
      }
    });
    Object.values(state.pages).forEach(p => {
      if (p.parentId === id) {
        get().duplicatePage(p.id, newFolderId, targetNotebookId);
      }
    });

    setTimeout(() => get().save(), 0);
  },

  duplicatePage: (id, parentId, notebookId) => {
    const state = get();
    const page = state.pages[id];
    if (!page) return;

    const clientId = useSyncStore.getState().clientId;
    const targetParentId = parentId || page.parentId;
    const targetNotebookId = notebookId || page.notebookId;

    // Calculate order
    const siblings = [
      ...Object.values(state.folders).filter(f => f.parentId === targetParentId),
      ...Object.values(state.pages).filter(p => p.parentId === targetParentId)
    ];
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) : 0;

    const newPageId = uuidv4();
    const newPage: Page = {
      ...page,
      id: newPageId,
      name: page.name,
      parentId: targetParentId,
      notebookId: targetNotebookId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: maxOrder + 10000,
      version: 1,
      dirty: true,
      lastModifier: clientId,
    };

    set(state => ({
      pages: { ...state.pages, [newPageId]: newPage }
    }));

    // Copy content in OPFS
    opfs.loadFile(`page-${id}.tldr`).then(content => {
      if (content) {
        opfs.saveFile(`page-${newPageId}.tldr`, content);
      }
    });

    setTimeout(() => get().save(), 0);
  },

  importNotebook: (data) => {
    const clientId = useSyncStore.getState().clientId;
    const maxOrder = get().notebooks.length > 0 ? Math.max(...get().notebooks.map(n => n.order || 0)) : 0;
    const newNotebookId = uuidv4();

    // We expect data to have { notebook, folders: [], pages: [] } or just notebook
    const notebookData = data.notebook || data;
    const newNotebook: Notebook = {
      ...notebookData,
      id: newNotebookId,
      createdAt: Date.now(),
      order: maxOrder + 10000,
      version: 1,
      dirty: true,
      lastModifier: clientId,
    };

    set(state => ({
      notebooks: [...state.notebooks, newNotebook].sort((a, b) => (a.order || 0) - (b.order || 0))
    }));

    // Import children if available
    if (data.folders) {
      // Need a mapping from old IDs to new IDs to maintain hierarchy
      const idMap: Record<string, string> = { [notebookData.id]: newNotebookId };

      // Sort folders by parentId depth or just handle them iteratively
      // Safest is to handle top-level first
      const foldersToImport = [...data.folders];
      while (foldersToImport.length > 0) {
        const initialLen = foldersToImport.length;
        for (let i = 0; i < foldersToImport.length; i++) {
          const f = foldersToImport[i];
          if (idMap[f.parentId]) {
            const newId = uuidv4();
            idMap[f.id] = newId;
            get().importFolder({ ...f, id: newId, parentId: idMap[f.parentId], notebookId: newNotebookId }, idMap[f.parentId], newNotebookId);
            foldersToImport.splice(i, 1);
            i--;
          }
        }
        if (foldersToImport.length === initialLen) break; // Avoid infinite loop if orphaned
      }

      if (data.pages) {
        data.pages.forEach((p: any) => {
          if (idMap[p.parentId]) {
            get().importPage({ ...p, parentId: idMap[p.parentId], notebookId: newNotebookId }, idMap[p.parentId], newNotebookId);
          }
        });
      }
    }

    setTimeout(() => get().save(), 0);
  },

  importFolder: (data, parentId, notebookId) => {
    const state = get();
    const clientId = useSyncStore.getState().clientId;
    const targetParentId = parentId || data.parentId;
    const targetNotebookId = notebookId || data.notebookId;

    const siblings = [
      ...Object.values(state.folders).filter(f => f.parentId === targetParentId),
      ...Object.values(state.pages).filter(p => p.parentId === targetParentId)
    ];
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) : 0;

    const newFolderId = uuidv4();
    const folderData = data.folder || data;
    const newFolder: Folder = {
      ...folderData,
      id: newFolderId,
      parentId: targetParentId,
      notebookId: targetNotebookId,
      createdAt: Date.now(),
      order: maxOrder + 10000,
      version: 1,
      dirty: true,
      lastModifier: clientId,
    };

    set(state => ({
      folders: { ...state.folders, [newFolderId]: newFolder }
    }));

    // Import children if available
    if (data.folders || data.pages) {
      const idMap: Record<string, string> = { [folderData.id]: newFolderId };
      const foldersToImport = [...(data.folders || [])];
      while (foldersToImport.length > 0) {
        const initialLen = foldersToImport.length;
        for (let i = 0; i < foldersToImport.length; i++) {
          const f = foldersToImport[i];
          if (idMap[f.parentId]) {
            const newId = uuidv4();
            idMap[f.id] = newId;
            get().importFolder({ ...f, id: newId, parentId: idMap[f.parentId], notebookId: targetNotebookId }, idMap[f.parentId], targetNotebookId);
            foldersToImport.splice(i, 1);
            i--;
          }
        }
        if (foldersToImport.length === initialLen) break;
      }
      if (data.pages) {
        data.pages.forEach((p: any) => {
          if (idMap[p.parentId]) {
            get().importPage({ ...p, parentId: idMap[p.parentId], notebookId: targetNotebookId }, idMap[p.parentId], targetNotebookId);
          }
        });
      }
    }

    setTimeout(() => get().save(), 0);
  },

  importPage: (data, parentId, notebookId) => {
    const state = get();
    const clientId = useSyncStore.getState().clientId;
    const targetParentId = parentId || data.parentId;
    const targetNotebookId = notebookId || data.notebookId;

    const siblings = [
      ...Object.values(state.folders).filter(f => f.parentId === targetParentId),
      ...Object.values(state.pages).filter(p => p.parentId === targetParentId)
    ];
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) : 0;

    const newPageId = uuidv4();
    const pageData = data.page || data;
    const newPage: Page = {
      ...pageData,
      id: newPageId,
      parentId: targetParentId,
      notebookId: targetNotebookId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: maxOrder + 10000,
      version: 1,
      dirty: true,
      lastModifier: clientId,
    };

    set(state => ({
      pages: { ...state.pages, [newPageId]: newPage }
    }));

    // Save content if provided
    if (data.content) {
      opfs.saveFile(`page-${newPageId}.tldr`, typeof data.content === 'string' ? data.content : JSON.stringify(data.content));
    } else {
      opfs.saveFile(`page-${newPageId}.tldr`, '{}');
    }

    setTimeout(() => get().save(), 0);
  },

  reorderNotebooks: (activeId, overId) => {
    set((state) => {
      const oldIndex = state.notebooks.findIndex(n => n.id === activeId);
      const newIndex = state.notebooks.findIndex(n => n.id === overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return {};

      const newNotebooks = [...state.notebooks];
      const [moved] = newNotebooks.splice(oldIndex, 1);
      newNotebooks.splice(newIndex, 0, moved);

      // Recalculate orders based on new array positions to ensure persistence
      const updatedNotebooks = newNotebooks.map((n, idx) => {
        const newOrder = (idx + 1) * 10000;
        // Mark as dirty if order changed
        if (n.order !== newOrder) {
          return { ...n, order: newOrder, dirty: true, lastModifier: useSyncStore.getState().clientId };
        }
        return n;
      });

      syncLog(`☁️ [FileSystem] Reordered notebook "${moved.name}" and marked dirty for sync`);
      setTimeout(() => get().save(), 0);
      return { notebooks: updatedNotebooks };
    });
  },


  moveNode: (activeId, overId, isContainer = false) => {
    set((state) => {
      const folders = { ...state.folders };
      const pages = { ...state.pages };

      // Helper to update notebookId recursively
      const recursiveUpdateNotebookId = (folderId: string, newNotebookId: string) => {
        // Update subfolders
        Object.keys(folders).forEach(fid => {
          if (folders[fid].parentId === folderId) {
            folders[fid] = { ...folders[fid], notebookId: newNotebookId };
            recursiveUpdateNotebookId(fid, newNotebookId); // Recurse
          }
        });
        // Update pages
        Object.keys(pages).forEach(pid => {
          if (pages[pid].parentId === folderId) {
            pages[pid] = { ...pages[pid], notebookId: newNotebookId };
          }
        });
      };


      // 0. Security check: Cannot move an item to itself or its descendants
      if (activeId === overId) return {};

      // Helper to check for descendants in state
      const isNodeDescendant = (childId: string, ancestorId: string): boolean => {
        let current = folders[childId] || pages[childId];
        while (current && current.parentId) {
          if (current.parentId === ancestorId) return true;
          current = folders[current.parentId];
        }
        return false;
      };

      if (isNodeDescendant(overId, activeId)) {
        syncLog(`🚫 [FileSystem] Blocked circular move: cannot move "${activeId}" into its descendant "${overId}"`);
        return {};
      }

      // 1. Identify what is being moved
      const activeItem = folders[activeId] || pages[activeId];
      if (!activeItem) return {};

      let targetParentId: string | null = null;
      let targetNotebookId = "";
      let newOrder = 0;

      // 2. Determine Target Parent and Order based on isContainer
      if (isContainer) {
        // Explicit drop into a container (Folder or Notebook)
        targetParentId = overId;

        const folderContainer = folders[overId];
        const notebookContainer = state.notebooks.find(n => n.id === overId);

        if (folderContainer) {
          targetNotebookId = folderContainer.notebookId;
        } else if (notebookContainer) {
          targetNotebookId = notebookContainer.id;
        } else {
          return {}; // Unknown container
        }

        // Append to end: Find max order of active siblings in this container
        const siblings = [
          ...Object.values(folders).filter(f => f.parentId === targetParentId),
          ...Object.values(pages).filter(p => p.parentId === targetParentId)
        ];
        const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) : 0;
        newOrder = maxOrder + 10000;

      } else {
        // Dropped on an item (Reorder relative to it)
        const overItem = folders[overId] || pages[overId];
        if (!overItem) return {};

        targetParentId = overItem.parentId;
        targetNotebookId = overItem.notebookId;

        // Get siblings of target
        const siblings = [
          ...Object.values(folders).filter(f => f.parentId === targetParentId),
          ...Object.values(pages).filter(p => p.parentId === targetParentId)
        ].sort((a, b) => (a.order || 0) - (b.order || 0));

        // Find index where we want to insert (before overItem)
        const overIndex = siblings.findIndex(s => s.id === overId);
        if (overIndex === -1) return {};

        // Calculate new order. 
        const prevItem = siblings[overIndex - 1];
        const nextItem = siblings[overIndex]; // This is overItem

        const prevOrder = prevItem ? (prevItem.order || 0) : 0;
        const nextOrder = nextItem.order || 0;

        if (!prevItem) {
          newOrder = nextOrder / 2;
        } else {
          newOrder = (prevOrder + nextOrder) / 2;
        }
      }

      // Update the moved item
      const newItem = {
        ...activeItem,
        parentId: targetParentId,
        notebookId: targetNotebookId,
        order: newOrder,
        dirty: true,
        lastModifier: useSyncStore.getState().clientId
      };

      // If moving a folder to a new notebook, recursive update
      if (folders[activeId] && newItem.notebookId !== activeItem.notebookId) {
        recursiveUpdateNotebookId(activeId, newItem.notebookId);
      }

      if (folders[activeId]) folders[activeId] = newItem as Folder;
      if (pages[activeId]) pages[activeId] = newItem as Page;

      const itemType = folders[activeId] ? 'folder' : 'page';
      const itemName = newItem.name || activeId;
      syncLog(`🔶 [FileSystem] Moved ${itemType} "${itemName}" - dirty`);

      setTimeout(() => get().save(), 0);
      return { folders, pages };
    });
  },

  markPageDirty: (pageId) => {
    set((state) => {
      const pages = { ...state.pages };
      if (!pages[pageId]) return {};

      const clientId = useSyncStore.getState().clientId;

      pages[pageId] = {
        ...pages[pageId],
        dirty: true,
        updatedAt: Date.now(),
        lastModifier: clientId
      };

      return { pages };
    });
    get().save();
  },


  save: async () => {
    const { notebooks, folders, pages, activeNotebookId, activePath, activePageId, activeStateUpdatedAt, activeStateModifier } = get();
    // Persist active state along with data
    const data = {
      notebooks,
      folders,
      pages,
      activeNotebookId,
      deletedItemIds: get().deletedItemIds,
      activePath,
      activePageId,
      activeStateUpdatedAt,
      activeStateModifier
    };
    await opfs.saveFile(METADATA_FILE, JSON.stringify(data));

    // Notify sync store (if not already syncing/saving)
    const syncStore = useSyncStore.getState();
    if (syncStore.isEnabled && syncStore.status === 'idle') {
      // Logic for triggering sync will be handled by the syncStore observer or manual trigger
      // For now, let's just mark that a save happened
      console.log("Metadata saved, sync could be triggered");
    }
  },

  load: async () => {
    const json = await opfs.loadFile(METADATA_FILE);
    const clientId = useSyncStore.getState().clientId;
    if (json) {
      try {
        const data = JSON.parse(json);

        // Deduplication helper for load
        const deduplicate = <T extends { id: string, version: number, dirty?: boolean }>(items: T[]): T[] => {
          const map = new Map<string, T>();
          items.forEach(item => {
            const existing = map.get(item.id);
            if (!existing || (item.version > existing.version) || (item.dirty && !existing.dirty)) {
              map.set(item.id, item);
            }
          });
          return Array.from(map.values());
        };

        // Ensure versioning exists on loaded data and migrate from baseVersion to dirty
        const notebooksRaw = (data.notebooks || []).map((n: any, idx: number) => ({
          ...n,
          version: n.version || 1,
          order: n.order !== undefined ? n.order : (idx + 1) * 10000,
          // Migration: if baseVersion exists and differs from version, item is dirty
          dirty: n.dirty !== undefined ? n.dirty : (n.baseVersion !== undefined ? n.version > n.baseVersion : false),
          lastModifier: n.lastModifier || clientId
        }));

        // Deduplicate notebooks to fix the "duplicate entries" bug
        const notebooks = deduplicate<Notebook>(notebooksRaw)
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

        const folders = { ...data.folders };
        Object.keys(folders).forEach(id => {
          const f = folders[id] as any;
          folders[id] = {
            ...f,
            version: f.version || 1,
            dirty: f.dirty !== undefined ? f.dirty : (f.baseVersion !== undefined ? f.version > f.baseVersion : false),
            lastModifier: f.lastModifier || clientId
          };
        });

        const pages = { ...data.pages };
        Object.keys(pages).forEach(id => {
          const p = pages[id] as any;
          pages[id] = {
            ...p,
            version: p.version || 1,
            dirty: p.dirty !== undefined ? p.dirty : (p.baseVersion !== undefined ? p.version > p.baseVersion : false),
            lastModifier: p.lastModifier || clientId
          };
        });

        set({
          notebooks,
          folders,
          pages,
          deletedItemIds: data.deletedItemIds || [],
          // Restore active state
          activeNotebookId: data.activeNotebookId || null,
          activePath: data.activePath || [],
          activePageId: data.activePageId || null,
          activeStateUpdatedAt: data.activeStateUpdatedAt || 0,
          activeStateModifier: data.activeStateModifier || ''
        });
      } catch (e) {
        console.error("Failed to parse metadata", e);
      }
    } else {
      // First time launch (or data cleared) - Create Default Content
      console.log('✨ [FileSystem] First launch detected. Creating default content.');

      const welcomeNotebookId = uuidv4();
      const welcomePageId = uuidv4();

      const defaultNotebook: Notebook = {
        id: welcomeNotebookId,
        name: i18n.t('untitled_notebook'), // Localized: e.g. "Cuaderno sin título"
        color: 'blue',
        createdAt: Date.now(),
        order: 10000,
        version: 1,
        dirty: false, // Start clean so it doesn't auto-sync unless modified
        isPlaceholder: true,
        lastModifier: clientId
      };

      const defaultPage: Page = {
        id: welcomePageId,
        notebookId: welcomeNotebookId,
        parentId: welcomeNotebookId,
        name: i18n.t('untitled_page'), // Localized: e.g. "Nueva página"
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: 10000,
        version: 1,
        dirty: false, // Start clean
        isPlaceholder: true,
        lastModifier: clientId
      };

      // Need to create the actual file content for the page too (empty or welcome text)
      // For now, empty canvas is fine, or we could seed it.
      // Let's ensure the file exists so it doesn't error on load.
      await opfs.saveFile(`page-${welcomePageId}.tldr`, JSON.stringify({}));

      set({
        notebooks: [defaultNotebook],
        folders: {},
        pages: { [welcomePageId]: defaultPage },
        deletedItemIds: [],
        activeNotebookId: welcomeNotebookId,
        activePageId: null, // Select only the notebook root, not the page
        activePath: [], // activePath should be empty; activeNotebookId defines the root context
        activeStateUpdatedAt: Date.now(),
        activeStateModifier: clientId
      });

      // Save immediately to persist this state
      get().save();
    }
  },

  clearDirtyFlags: () => {
    set((state) => ({
      notebooks: state.notebooks.map(n => ({ ...n, dirty: false })),
      folders: Object.fromEntries(Object.entries(state.folders).map(([id, f]) => [id, { ...f, dirty: false }])),
      pages: Object.fromEntries(Object.entries(state.pages).map(([id, p]) => [id, { ...p, dirty: false }])),
    }));
    get().save();
  },

  mergeRemoteData: (remoteData) => {
    set((state) => {
      // Helper to deduplicate items by ID, keeping the "best" one (most recent version or dirty)
      const deduplicate = <T extends Notebook | Folder | Page>(items: T[]): T[] => {
        const map = new Map<string, T>();
        items.forEach(item => {
          const existing = map.get(item.id);
          const isBetter = !existing || 
            (item.dirty && !existing.dirty) || 
            (item.version > existing.version);
            
          if (isBetter) {
            map.set(item.id, item);
          }
        });
        return Array.from(map.values());
      };

      // 1. Merge tombstones: Keep both remote and any new local ones
      const deletedItemIds = [...new Set([
        ...(remoteData.deletedItemIds || []),
        ...(state.deletedItemIds || [])
      ])];

      const remoteActiveUpdatedAt = remoteData.activeStateUpdatedAt || 0;
      const shouldUpdateActiveState = remoteActiveUpdatedAt > state.activeStateUpdatedAt;

      // 2. Notebooks: Merge and respect new local dirty ones
      const remoteNotebooks = remoteData.notebooks || [];
      const newLocalNotebooks = state.notebooks.filter(ln =>
        ln.dirty && !remoteNotebooks.find((rn: Notebook) => rn.id === ln.id)
      );
      const notebooksToMerge = remoteNotebooks.map((rn: Notebook) => {
        // Find local version. If we have multiple (bug), take the dirty one or the first one.
        const localItems = state.notebooks.filter(ln => ln.id === rn.id);
        const local = localItems.find(l => l.dirty) || localItems[0];
        
        // If local is dirty, keep local to avoid losing mid-sync changes
        return (local && local.dirty) ? local : rn;
      });

      // deduplicate handles potential duplicates in remoteData or state
      const newNotebooks = deduplicate([...notebooksToMerge, ...newLocalNotebooks])
        .filter((n: Notebook) => !deletedItemIds.includes(n.id))
        .sort((a: Notebook, b: Notebook) => (a.order || 0) - (b.order || 0));

      // 3. Folders: Merge similarly
      const remoteFolders = remoteData.folders || {};
      const folders = { ...remoteFolders };
      Object.entries(state.folders).forEach(([id, lf]) => {
        const rf = remoteFolders[id];
        // If local is dirty and (remote doesn't exist OR local version is at least as new as remote)
        if (lf.dirty && (!rf || lf.version >= rf.version)) {
          folders[id] = lf;
        }
      });
      // Filter out deleted
      Object.keys(folders).forEach(id => {
        if (deletedItemIds.includes(id)) delete folders[id];
      });

      // 4. Pages: Merge similarly
      const remotePages = remoteData.pages || {};
      const pages = { ...remotePages };
      Object.entries(state.pages).forEach(([id, lp]) => {
        const rp = remotePages[id];
        // Only preserve local dirty if its version is >= remote version to avoid reverting pulls
        if (lp.dirty && (!rp || lp.version >= rp.version)) {
          if (rp && lp.version < rp.version) {
            console.warn(`[FileSystem] Blocking dirty overwrite for ${id} because remote v${rp.version} is ahead of local v${lp.version}`);
          } else {
            pages[id] = lp;
          }
        }
      });
      // Filter out deleted
      Object.keys(pages).forEach(id => {
        if (deletedItemIds.includes(id)) delete pages[id];
      });

      let nextActiveNotebookId = shouldUpdateActiveState ? remoteData.activeNotebookId : state.activeNotebookId;
      let nextActivePageId = shouldUpdateActiveState ? remoteData.activePageId : state.activePageId;
      let nextActivePath = shouldUpdateActiveState ? (remoteData.activePath || []) : state.activePath;

      // Validate Active State: If the active item was deleted in this merge, reset it.
      if (nextActiveNotebookId && !newNotebooks.find((n: any) => n.id === nextActiveNotebookId)) {
        console.warn(`[FileSystem] Active notebook ${nextActiveNotebookId} no longer exists. Resetting.`);
        nextActiveNotebookId = null;
        nextActivePageId = null;
        nextActivePath = [];
      } else if (nextActivePageId && !pages[nextActivePageId]) {
        console.warn(`[FileSystem] Active page ${nextActivePageId} no longer exists. Deselecting.`);
        nextActivePageId = null;
      }

      return {
        notebooks: newNotebooks,
        folders,
        pages,
        deletedItemIds,
        activeNotebookId: nextActiveNotebookId,
        activePageId: nextActivePageId,
        activePath: nextActivePath,
        activeStateUpdatedAt: Math.max(state.activeStateUpdatedAt, remoteActiveUpdatedAt),
        activeStateModifier: shouldUpdateActiveState ? (remoteData.activeStateModifier || '') : state.activeStateModifier
      };
    });
    get().save();
  }
}));
