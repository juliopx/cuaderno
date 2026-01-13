
import { create } from 'zustand';
import type { Notebook, Folder, Page } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { opfs } from '../lib/opfs';

const METADATA_FILE = 'metadata.json';


interface FileSystemState {
  notebooks: Notebook[];
  folders: Record<string, Folder>; // Keyed by ID
  pages: Record<string, Page>; // Keyed by ID

  activeNotebookId: string | null;
  activePath: string[]; // Array of IDs starting from notebook -> folder -> subfolder
  activePageId: string | null;
  isSidebarOpen: boolean;
  theme: 'auto' | 'light' | 'dark';

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'auto' | 'light' | 'dark') => void;

  createNotebook: (name: string) => void;
  createFolder: (name: string, parentId: string, notebookId: string) => void;
  createPage: (name: string, parentId: string, notebookId: string) => void;

  setActiveNotebook: (id: string) => void;
  navigatePath: (path: string[]) => void;
  openFolder: (id: string) => void; // Adds to path
  closeFolder: (id: string) => void; // Removes from path (and children)
  selectPage: (id: string) => void;
  renameNode: (id: string, name: string, strokes?: string) => void;

  deleteNotebook: (id: string) => void;
  deleteFolder: (id: string) => void;
  deletePage: (id: string) => void;


  // Persistence
  load: () => Promise<void>;
  save: () => Promise<void>;

  reorderNotebooks: (activeId: string, overId: string) => void;
  moveNode: (activeId: string, overId: string, isContainer?: boolean) => void;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  notebooks: [],
  folders: {},
  pages: {},

  activeNotebookId: null,
  activePath: [],
  activePageId: null,
  isSidebarOpen: true,
  theme: (localStorage.getItem('cuaderno-theme') as any) || 'auto',

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setTheme: (theme) => {
    localStorage.setItem('cuaderno-theme', theme);
    set({ theme });
  },


  createNotebook: (name) => {
    const newNotebook: Notebook = {
      id: uuidv4(),
      name,
      createdAt: Date.now(),
    };
    set((state) => ({ notebooks: [...state.notebooks, newNotebook] }));
  },

  createFolder: (name, parentId, notebookId) => {
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
      };

      setTimeout(() => get().save(), 0); // Trigger save
      return { folders: { ...state.folders, [newFolder.id]: newFolder } };
    });
  },

  createPage: (name, parentId, notebookId) => {
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
      };
      const nextState = { pages: { ...state.pages, [newPage.id]: newPage } };
      // Trigger save
      setTimeout(() => get().save(), 0);
      return nextState;
    });
  },

  navigatePath: (path: string[]) => {
    set({ activePath: path, activePageId: null });
    setTimeout(() => get().save(), 0);
  },

  setActiveNotebook: (id) => {
    set({ activeNotebookId: id, activePath: [], activePageId: null });
    setTimeout(() => get().save(), 0);
  },

  openFolder: (id) => set((state) => {
    // Logic to ensure path correctness could go here
    return { activePath: [...state.activePath, id] };
  }),
  closeFolder: (id) => set((state) => ({
    activePath: state.activePath.filter(pathId => pathId !== id)
  })), // Simplified, might need more robust logic to remove *subsequent* folders too if in a column view

  selectPage: (id) => {
    const state = get();
    const page = state.pages[id];
    if (!page) return;

    const path: string[] = [];
    let currentParentId: string | null = page.parentId;
    let notebookId: string = page.notebookId;

    if (!notebookId) return;

    // Build the folder path (reversed)
    while (currentParentId && currentParentId !== notebookId) {
      const folder: Folder = state.folders[currentParentId];
      if (!folder) break;
      path.unshift(folder.id);
      currentParentId = folder.parentId || null;
    }

    set({
      activePageId: id,
      activeNotebookId: notebookId,
      activePath: path // Array of folder IDs
    });
    setTimeout(() => get().save(), 0);
  },


  renameNode: (id, name, strokes) => {
    set((state) => {
      let notebooks = [...state.notebooks];
      let folders = { ...state.folders };
      let pages = { ...state.pages };

      const nbIdx = notebooks.findIndex(n => n.id === id);
      if (nbIdx !== -1) notebooks[nbIdx] = { ...notebooks[nbIdx], name, nameStrokes: strokes };

      if (folders[id]) folders[id] = { ...folders[id], name, nameStrokes: strokes };
      if (pages[id]) pages[id] = { ...pages[id], name, nameStrokes: strokes };

      const nextState = { notebooks, folders, pages };
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
      Object.keys(folders).forEach(fid => {
        if (folders[fid].notebookId === id) delete folders[fid];
      });
      Object.keys(pages).forEach(pid => {
        if (pages[pid].notebookId === id) delete pages[pid];
      });

      const activeNotebookId = state.activeNotebookId === id ? null : state.activeNotebookId;
      const activePath = state.activeNotebookId === id ? [] : state.activePath;
      const activePageId = (state.activePageId && !pages[state.activePageId]) ? null : state.activePageId;

      setTimeout(() => get().save(), 0);
      return { notebooks, folders, pages, activeNotebookId, activePath, activePageId };
    });
  },

  deleteFolder: (id) => {
    set((state) => {
      const folders = { ...state.folders };
      const pages = { ...state.pages };

      const deleteRecursive = (folderId: string) => {
        // Delete pages in this folder
        Object.keys(pages).forEach(pid => {
          if (pages[pid].parentId === folderId) delete pages[pid];
        });
        // Find subfolders
        Object.keys(folders).forEach(fid => {
          if (folders[fid].parentId === folderId) {
            deleteRecursive(fid);
          }
        });
        delete folders[folderId];
      };

      deleteRecursive(id);

      // If active path contains this folder or its children, truncate it
      const folderIdx = state.activePath.indexOf(id);
      const activePath = folderIdx !== -1 ? state.activePath.slice(0, folderIdx) : state.activePath;
      const activePageId = (state.activePageId && !pages[state.activePageId]) ? null : state.activePageId;

      setTimeout(() => get().save(), 0);
      return { folders, pages, activePath, activePageId };
    });
  },

  deletePage: (id) => {
    set((state) => {
      const pages = { ...state.pages };
      delete pages[id];
      const activePageId = state.activePageId === id ? null : state.activePageId;

      setTimeout(() => get().save(), 0);
      return { pages, activePageId };
    });
  },

  reorderNotebooks: (activeId, overId) => {
    set((state) => {
      const oldIndex = state.notebooks.findIndex(n => n.id === activeId);
      const newIndex = state.notebooks.findIndex(n => n.id === overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return {};

      const newNotebooks = [...state.notebooks];
      const [moved] = newNotebooks.splice(oldIndex, 1);
      newNotebooks.splice(newIndex, 0, moved);

      setTimeout(() => get().save(), 0);
      return { notebooks: newNotebooks };
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
      let newItem = {
        ...activeItem,
        parentId: targetParentId,
        notebookId: targetNotebookId,
        order: newOrder
      };

      // If moving a folder to a new notebook, recursive update
      if (folders[activeId] && newItem.notebookId !== activeItem.notebookId) {
        recursiveUpdateNotebookId(activeId, newItem.notebookId);
      }

      if (folders[activeId]) folders[activeId] = newItem as Folder;
      if (pages[activeId]) pages[activeId] = newItem as Page;


      setTimeout(() => get().save(), 0);
      return { folders, pages };
    });
  },


  save: async () => {
    const { notebooks, folders, pages, activeNotebookId, activePath, activePageId } = get();
    // Persist active state along with data
    const data = {
      notebooks,
      folders,
      pages,
      activeNotebookId,
      activePath,
      activePageId
    };
    await opfs.saveFile(METADATA_FILE, JSON.stringify(data));
  },

  load: async () => {
    const json = await opfs.loadFile(METADATA_FILE);
    if (json) {
      try {
        const data = JSON.parse(json);
        set({
          notebooks: data.notebooks || [],
          folders: data.folders || {},
          pages: data.pages || {},
          // Restore active state
          activeNotebookId: data.activeNotebookId || null,
          activePath: data.activePath || [],
          activePageId: data.activePageId || null
        });
      } catch (e) {
        console.error("Failed to parse metadata", e);
      }
    }
  }
}));
