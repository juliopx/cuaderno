
export interface Notebook {
  id: string;
  name: string;
  nameStrokes?: string; // SVG path data
  color?: string;
  createdAt: number;
  order: number;
  version: number;
  dirty?: boolean; // True if has local changes not yet synced
  isPlaceholder?: boolean; // True if created as default onboarding content
  lastModifier: string;
  driveFileId?: string;
}

export interface Folder {
  id: string;
  notebookId: string;
  parentId: string | null; // null if root of notebook (or we can have a generic root)
  name: string;
  nameStrokes?: string; // SVG path data
  color?: string;
  createdAt: number;
  order: number;
  version: number;
  dirty?: boolean; // True if has local changes not yet synced
  isPlaceholder?: boolean;
  lastModifier: string;
  driveFileId?: string;
}

export interface Page {
  id: string;
  notebookId: string;
  parentId: string; // Folder ID or Notebook ID (if generic root)
  name: string;
  nameStrokes?: string; // SVG path data
  color?: string;
  createdAt: number;
  // content is stored separately in OPFS, but we might track last modified here
  updatedAt: number;
  order: number;
  version: number;
  dirty?: boolean; // True if has local changes not yet synced
  isPlaceholder?: boolean;
  lastModifier: string;
  driveFileId?: string;
}

export type FileSystemNode = Notebook | Folder | Page;

export type NodeType = 'notebook' | 'folder' | 'page';
