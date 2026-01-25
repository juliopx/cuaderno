
import { opfs } from '../lib/opfs';
import type { Notebook, Folder, Page } from '../types';

export const exportItem = async (
  item: Notebook | Folder | Page,
  folders: Record<string, Folder>,
  pages: Record<string, Page>,
  type: 'notebook' | 'folder' | 'page'
) => {
  const exportData: any = {
    type,
    exportedAt: Date.now(),
  };

  if (type === 'notebook') {
    const notebook = item as Notebook;
    exportData.notebook = notebook;
    exportData.folders = Object.values(folders).filter(f => f.notebookId === notebook.id);
    const notebookPages = Object.values(pages).filter(p => p.notebookId === notebook.id);

    // Attach content for each page
    const pagesWithContent = await Promise.all(notebookPages.map(async p => {
      const content = await opfs.loadFile(`page-${p.id}.tldr`);
      return { ...p, content: content ? JSON.parse(content) : {} };
    }));
    exportData.pages = pagesWithContent;
  } else if (type === 'folder') {
    const folder = item as Folder;
    exportData.folder = folder;

    // Find all descendants
    const descendantFolders: Folder[] = [];
    const descendantPages: any[] = [];

    const findDescendants = async (fid: string) => {
      const subfolders = Object.values(folders).filter(f => f.parentId === fid);
      const subpages = Object.values(pages).filter(p => p.parentId === fid);

      descendantFolders.push(...subfolders);

      const subpagesWithContent = await Promise.all(subpages.map(async p => {
        const content = await opfs.loadFile(`page-${p.id}.tldr`);
        return { ...p, content: content ? JSON.parse(content) : {} };
      }));
      descendantPages.push(...subpagesWithContent);

      for (const sf of subfolders) {
        await findDescendants(sf.id);
      }
    };

    await findDescendants(folder.id);
    exportData.folders = descendantFolders;
    exportData.pages = descendantPages;
  } else if (type === 'page') {
    const page = item as Page;
    const content = await opfs.loadFile(`page-${page.id}.tldr`);
    exportData.page = page;
    exportData.content = content ? JSON.parse(content) : {};
  }

  const jsonString = JSON.stringify(exportData);
  const jsonBlob = new Blob([jsonString], { type: 'application/json' });

  // Compress using Gzip
  const compressionStream = new CompressionStream('gzip');
  const compressedStream = jsonBlob.stream().pipeThrough(compressionStream);
  const compressedBlob = await new Response(compressedStream).blob();

  const url = URL.createObjectURL(compressedBlob);
  const extension = type === 'page' ? 'pag' : 'cua';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${item.name || 'export'}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
