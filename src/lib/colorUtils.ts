import type { Notebook, Folder, Page } from '../types';

export const resolveItemColor = (
  itemId: string,
  folders: Record<string, Folder>,
  pages: Record<string, Page>,
  notebooks: Notebook[]
): string => {

  // 1. Check the item itself
  let item: Notebook | Folder | Page | undefined;

  // Find the item first to start checking
  if (folders[itemId]) item = folders[itemId];
  else if (pages[itemId]) item = pages[itemId];
  else item = notebooks.find(n => n.id === itemId);

  if (!item) return 'blue'; // Default fallback

  if ((item as any).color && (item as any).color !== 'black' && (item as any).color !== 'auto') {
    return (item as any).color;
  }

  // 2. Walk up the tree
  // If it's a page or folder, it has a parentId
  while (item && (item as any).parentId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentId: string = (item as any).parentId;
    const parentFolder = folders[parentId];
    if (parentFolder) {
      if (parentFolder.color && parentFolder.color !== 'black' && parentFolder.color !== 'auto') return parentFolder.color;
      item = parentFolder;
    } else {
      // Parent might be a notebook?
      // Notebooks are not in 'folders' map, but folders have 'notebookId'.
      break;
    }
  }

  // 3. Check Notebook
  // If we are here, we didn't find a color in the folder hierarchy.
  // Check the notebook of the original item or the last traveled ancestor.
  // Re-fetch original item to be sure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalItem: any = folders[itemId] || pages[itemId] || notebooks.find(n => n.id === itemId);

  // If the item walked up to a folder that belongs to a notebook, 'item' might be that folder now.
  // But reliable way is to check the notebookId of the original item (all descendents share notebookId).
  // Or if original item was notebook, we checked it in step 1.

  if (originalItem && originalItem.notebookId) {
    const notebook = notebooks.find(n => n.id === originalItem.notebookId);
    if (notebook && notebook.color && notebook.color !== 'black' && notebook.color !== 'auto') {
      return notebook.color;
    }
  }

  return 'blue';
};


import { DefaultColorThemePalette } from 'tldraw';

export const getThemeColorHex = (colorName: string, isDarkMode: boolean): string => {
  const theme = isDarkMode ? DefaultColorThemePalette.darkMode : DefaultColorThemePalette.lightMode;
  // If colorName is invalid or defaults to 'blue'
  const colorKey = (colorName in theme) ? colorName : 'blue';
  // @ts-ignore - We know colorKey is valid or 'blue' which is valid
  return theme[colorKey].solid;
};
