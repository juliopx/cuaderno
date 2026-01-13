
export interface Notebook {
  id: string;
  name: string;
  nameStrokes?: string; // SVG path data
  createdAt: number;
}

export interface Folder {
  id: string;
  notebookId: string;
  parentId: string | null; // null if root of notebook (or we can have a generic root)
  name: string;
  nameStrokes?: string; // SVG path data
  createdAt: number;
  order: number;
}

export interface Page {
  id: string;
  notebookId: string;
  parentId: string; // Folder ID or Notebook ID (if generic root)
  name: string;
  nameStrokes?: string; // SVG path data
  createdAt: number;
  // content is stored separately in OPFS, but we might track last modified here
  updatedAt: number;
  order: number;
}

export type FileSystemNode = Notebook | Folder | Page;

export type NodeType = 'notebook' | 'folder' | 'page';
