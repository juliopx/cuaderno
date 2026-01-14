
// Simple OPFS wrapper
export const opfs = {
  async getRoot() {
    return await navigator.storage.getDirectory();
  },

  async saveFile(filename: string, content: string | Blob) {
    try {
      const root = await this.getRoot();
      const fileHandle = await root.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (e) {
      console.error(`Error saving ${filename}`, e);
    }
  },

  async loadFile(filename: string): Promise<string | null> {
    try {
      const root = await this.getRoot();
      try {
        const fileHandle = await root.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return await file.text();
      } catch (e) {
        // File not found is fine
        return null;
      }
    } catch (e) {
      console.error(`Error loading ${filename}`, e);
      return null;
    }
  },

  async listFiles() {
    const root = await this.getRoot();
    const files = [];
    // @ts-ignore - TS might not have full iterator types for FileSystemDirectoryHandle yet
    for await (const [name, handle] of root.entries()) {
      files.push(name);
    }
    return files;
  },

  async clearAll() {
    try {
      const root = await this.getRoot();
      const files = await this.listFiles();

      console.log(`🗑️ Deleting ${files.length} files from OPFS...`);

      for (const filename of files) {
        await root.removeEntry(filename);
        console.log(`  ✓ Deleted ${filename}`);
      }

      console.log('✅ OPFS cleared successfully!');
      return { success: true, deletedCount: files.length };
    } catch (e) {
      console.error('❌ Error clearing OPFS:', e);
      return { success: false, error: e };
    }
  }
};
