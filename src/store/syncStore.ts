import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { googleDrive } from '../lib/googleDrive';
import { useFileSystemStore } from './fileSystemStore';
import { opfs } from '../lib/opfs';
import { toast } from 'sonner';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict' | 'saving-to-disk';

interface SyncState {
  clientId: string;
  status: SyncStatus;
  lastSync: number | null;
  isEnabled: boolean;
  isConfigured: boolean; // Has authorized Google Drive
  error: string | null;
  rootFolderId: string | null;
  conflicts: any | null; // Stores { localData, remoteData }
  user: { name: string; photo: string } | null;

  // Actions
  setClientId: (id: string) => void;
  setStatus: (status: SyncStatus) => void;
  setLastSync: (time: number) => void;
  setIsEnabled: (enabled: boolean) => void;
  setIsConfigured: (configured: boolean) => void;
  setError: (error: string | null) => void;

  // Sync logic
  initialize: () => void;
  authenticate: (prompt?: 'consent' | 'select_account' | 'none') => Promise<void>;
  sync: (manual?: boolean) => Promise<void>;
  setupConnection: (token: string, silent?: boolean) => Promise<void>;
  resolveConflict: (resolution: 'local' | 'remote') => Promise<void>;
  logout: (deleteData?: boolean) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  clientId: '',
  status: 'idle',
  lastSync: null,
  isEnabled: localStorage.getItem('cuaderno-sync-enabled') === 'true',
  isConfigured: !!localStorage.getItem('cuaderno-drive-token'),
  error: null,
  rootFolderId: localStorage.getItem('cuaderno-drive-root-id'),
  conflicts: null,
  user: JSON.parse(localStorage.getItem('cuaderno-user-info') || 'null'),

  setClientId: (clientId: string) => set({ clientId }),
  setStatus: (status: SyncStatus) => set({ status }),
  setLastSync: (lastSync: number) => set({ lastSync }),
  setIsEnabled: (isEnabled: boolean) => {
    localStorage.setItem('cuaderno-sync-enabled', String(isEnabled));
    set({ isEnabled });
  },
  setIsConfigured: (isConfigured: boolean) => set({ isConfigured }),
  setError: (error: string | null) => set({ error }),

  initialize: () => {
    let clientId = localStorage.getItem('cuaderno-client-id');
    if (!clientId) {
      clientId = uuidv4();
      localStorage.setItem('cuaderno-client-id', clientId);
    }
    set({ clientId });

    // Init Google Drive API
    googleDrive.init(async (token: string) => {
      const isRefreshing = !!localStorage.getItem('cuaderno-drive-token');
      localStorage.setItem('cuaderno-drive-token', token);
      await get().setupConnection(token, isRefreshing);
    }).then(async () => {
      // Library is ready. Check if we have a stored token to restore session.
      const storedToken = localStorage.getItem('cuaderno-drive-token');
      // Always try to restore connection if we have a token, even if state says configured (optimistic)
      if (storedToken) {
        await get().setupConnection(storedToken, true);
      }
    });
  },

  setupConnection: async (token: string, silent = false) => {
    set({ isConfigured: true });
    try {
      if (token) {
        await googleDrive.setToken(token);
      }
      const userInfo = await googleDrive.getUserInfo();
      const user = { name: userInfo.name, photo: userInfo.picture };

      localStorage.setItem('cuaderno-user-info', JSON.stringify(user));
      set({ user });

      if (!silent) toast.success('Connected to Google Drive');
      // Trigger initial sync if enabled
      if (get().isEnabled) {
        get().sync();
      }
    } catch (e) {
      console.error('Failed to restore session or fetch user info', e);
      // If token expired, try silent refresh
      if ((e as any).status === 401 || (e as any).result?.error?.code === 401) {
        console.warn('🔑 Token expired. Attempting silent refresh...');
        googleDrive.authenticateSilent();
      } else {
        localStorage.removeItem('cuaderno-drive-token');
        localStorage.removeItem('cuaderno-user-info');
        set({ isConfigured: false, user: null });
      }
    }
  },

  authenticate: async (prompt: 'consent' | 'select_account' | 'none' = 'select_account') => {
    await googleDrive.authenticate(prompt);
  },

  sync: async (manual = false) => {
    const state = get();
    if (!state.isConfigured || state.status !== 'idle') return;

    try {
      if (manual) {
        set({ status: 'saving-to-disk' });
        // Force save active page content to ensure we upload latest changes
        const fsStore = useFileSystemStore.getState();
        if (fsStore.forceSaveActivePage) {
          console.log('[Sync] Forcing save of active page content...');
          await fsStore.forceSaveActivePage();
        }
        await fsStore.save();
      }

      set({ status: 'syncing' });

      // 1. Ensure Root Folder
      let rootId = state.rootFolderId;
      if (!rootId) {
        const existing = await googleDrive.findFileByName('Cuaderno');
        if (existing) {
          rootId = existing.id;
        } else {
          rootId = await googleDrive.createFolder('Cuaderno');
        }
        set({ rootFolderId: rootId });
        localStorage.setItem('cuaderno-drive-root-id', rootId || '');
      }

      // 2. Fetch Remote Metadata
      const remoteMetaFile = await googleDrive.findFileByName('metadata.json', rootId || '');
      const fsStore = useFileSystemStore.getState();

      const localData = JSON.parse(JSON.stringify({
        notebooks: fsStore.notebooks,
        folders: fsStore.folders,
        pages: fsStore.pages,
        activeNotebookId: fsStore.activeNotebookId,
        activePath: fsStore.activePath,
        activePageId: fsStore.activePageId,
        activeStateUpdatedAt: fsStore.activeStateUpdatedAt,
        activeStateModifier: fsStore.activeStateModifier,
        deletedItemIds: fsStore.deletedItemIds || [],
        clientId: state.clientId,
      }));

      if (remoteMetaFile) {
        // @ts-ignore
        const remoteContentResponse = await gapi.client.drive.files.get({
          fileId: remoteMetaFile.id,
          alt: 'media'
        });
        const remoteData = typeof remoteContentResponse.body === 'string' ? JSON.parse(remoteContentResponse.body) : (remoteContentResponse.result || remoteContentResponse.body);

        // 3. Conflict Detection
        let hasConflict = false;
        let needsPull = false;
        let needsPush = false;

        const checkConflicts = (locals: any[], remotes: any[]) => {
          for (const localItem of locals) {
            const remoteItem = remotes.find((n: any) => n.id === localItem.id);
            if (remoteItem) {
              // Remote is ahead if version is greater (ignoring author to be robust against local state loss)
              const isRemoteAhead = remoteItem.version > localItem.version;

              // Local is changed if dirty flag is true (this is now the reliable source)
              const isLocalChanged = localItem.dirty;

              if (isRemoteAhead && isLocalChanged) {
                // True conflict: Remote moved ahead AND we have unsaved local changes
                hasConflict = true;
              } else if (isRemoteAhead) {
                // Remote moved ahead, we are clean -> Pull
                needsPull = true;
              } else if (isLocalChanged) {
                // We changed, remote is same version (or older/same but we have dirty) -> Push
                needsPush = true;
              }
            } else {
              // Remote item missing but we have it?
              // If we created it (dirty), then Push.
              // If we are clean but it's gone remote, technically we should delete local or re-upload.
              // For now, if dirty, we push (create remote).
              if (localItem.dirty) {
                needsPush = true;
              }
            }
          }
          if (remotes.some((r: any) => !locals.find(l => l.id === r.id))) {
            needsPull = true;
          }
        };

        checkConflicts(localData.notebooks, remoteData.notebooks);
        checkConflicts(Object.values(localData.folders), Object.values(remoteData.folders));
        checkConflicts(Object.values(localData.pages), Object.values(remoteData.pages));

        // 4. Active State Sync (Last modifier wins)
        const localActiveUpdatedAt = localData.activeStateUpdatedAt || 0;
        const remoteActiveUpdatedAt = remoteData.activeStateUpdatedAt || 0;

        if (remoteActiveUpdatedAt > localActiveUpdatedAt) {
          needsPull = true;
          console.log(`  📍 Remote active state is newer (${new Date(remoteActiveUpdatedAt).toLocaleTimeString()}). Pulling.`);
        } else if (localActiveUpdatedAt > remoteActiveUpdatedAt) {
          needsPush = true;
          console.log(`  📍 Local active state is newer (${new Date(localActiveUpdatedAt).toLocaleTimeString()}). Pushing.`);
        }

        // Log sync summary
        console.log('\n📊 [Sync] Summary:');
        console.log(`  Local: ${localData.notebooks.length} notebooks, ${Object.keys(localData.folders).length} folders, ${Object.keys(localData.pages).length} pages`);
        console.log(`  Remote: ${remoteData.notebooks.length} notebooks, ${Object.keys(remoteData.folders).length} folders, ${Object.keys(remoteData.pages).length} pages`);

        // Count dirty items
        const dirtyPages = Object.values(localData.pages).filter((p: any) => p.dirty);
        const dirtyFolders = Object.values(localData.folders).filter((f: any) => f.dirty);
        const dirtyNotebooks = localData.notebooks.filter((n: any) => n.dirty);

        if (dirtyPages.length > 0 || dirtyFolders.length > 0 || dirtyNotebooks.length > 0) {
          console.log(`  🔶 Dirty (pending sync): ${dirtyNotebooks.length} notebooks, ${dirtyFolders.length} folders, ${dirtyPages.length} pages`);
        }

        console.log(`  Decision: needsPull=${needsPull}, needsPush=${needsPush}, hasConflict=${hasConflict}\n`);

        if (hasConflict) {
          set({ status: 'conflict', conflicts: { localData, remoteData } });
          toast.error('Sync conflict detected');
          return;
        }

        if (needsPull && !needsPush) {
          console.log('[Sync] Needs pull. Downloading content...');
          // Clean Pull: Download specific pages if needed BEFORE merging metadata
          // This ensures OPFS has the new content when the UI reloads due to version change.

          for (const pageId in remoteData.pages) {
            const page = remoteData.pages[pageId];
            const localVersion = fsStore.pages[pageId]?.version || 0;

            console.log(`[Sync] Checking page ${pageId}: Remote v${page.version} vs Local v${localVersion}`);

            if (page.version > localVersion) {
              console.log(`[Sync] Downloading page ${pageId}...`);
              // Try the new filename format first, then fallback to old
              const driveFile = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootId!) || await googleDrive.findFileByName(`${pageId}.json`, rootId!);

              if (driveFile) {
                // @ts-ignore
                const contentResponse = await gapi.client.drive.files.get({ fileId: driveFile.id, alt: 'media' });
                const content = typeof contentResponse.body === 'string' ? contentResponse.body : JSON.stringify(contentResponse.result);
                // Save locally as 'page-{pageId}.tldr' regardless of source extension, to match CanvasArea expectations
                await opfs.saveFile(`page-${pageId}.tldr`, content);
                console.log(`[Sync] Page ${pageId} saved to disk as page-${pageId}.tldr.`);
              }
            }
          }

          // Update metadata (Zustand store) AFTER files are on disk.
          // This triggers CanvasArea to reload the snapshot with the new version.
          // 4. Handle Tombstones (Deletions)
          // If we have deleted items locally, we shouldn't re-add them from remote if remote still has them (unless remote version > local tombstone logic... but for simple sync, local delete wins if remote isn't newer)
          // Actually, 'needsPull' implies remote is newer/additive.
          // But if we deleted it, we want that deletion to propagate to remote on NEXT push.
          // However, if we are PULLING, it means remote changed. If remote has a NEW item, we take it.
          // If remote DOESN'T have an item we have, we might delete it?
          // No, conflict logic handles existence.

          // Implementation: If remote has 'deletedItemIds', applies them locally.
          const remoteTombstones = remoteData.deletedItemIds || [];
          if (remoteTombstones.length > 0) {
            console.log('[Sync] Processing remote deletions:', remoteTombstones);
            // Merging logic needs to respect these.
            // Let's filter the remoteData before merging if it contains stuff that is marked deleted in remote

            remoteData.notebooks = remoteData.notebooks.filter((n: any) => !remoteTombstones.includes(n.id));

            // For object-based folders/pages
            Object.keys(remoteData.folders).forEach(k => {
              if (remoteTombstones.includes(k)) delete remoteData.folders[k];
            });
            Object.keys(remoteData.pages).forEach(k => {
              if (remoteTombstones.includes(k)) delete remoteData.pages[k];
            });
          }

          console.log('[Sync] Updating local metadata and base versions...');
          fsStore.mergeRemoteData(remoteData);

          // If we had local tombstones that are now satisfied (item gone from remote), we could clean them up?
          // For now keep them to ensure propagation.


          toast.info('Changes downloaded from cloud');
        } else if (needsPush && !needsPull) {
          // Clean Push
          console.log('📤 [Sync] Pushing local changes...');

          // Upload page contents for dirty pages
          const pagesToUpload = Object.values(localData.pages).filter((p: any) => p.dirty);
          console.log(`  Uploading ${pagesToUpload.length} dirty page(s)...`);

          for (const pageId in localData.pages) {
            const page = localData.pages[pageId];
            if (page.dirty) {
              console.log(`  📄 Uploading page "${page.name}" (${pageId})...`);
              const content = await opfs.loadFile(`page-${pageId}.tldr`);
              if (content) {
                // Check for new filename first, fall back to old
                const existing = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootId!) || await googleDrive.findFileByName(`${pageId}.json`, rootId!);

                if (existing) {
                  console.log(`[Sync] Updating existing file: ${existing.name} (${existing.id})`);
                  await googleDrive.updateFile(existing.id, content);
                } else {
                  console.log(`[Sync] Creating new file: page-${pageId}.tldr`);
                  await googleDrive.createFile(`page-${pageId}.tldr`, content, 'application/json', rootId!);
                }

                // Increment version and clear dirty AFTER successful upload
                localData.pages[pageId].version += 1;
                localData.pages[pageId].dirty = false;
                localData.pages[pageId].lastModifier = state.clientId;
                console.log(`✅ [Sync] Page ${pageId} synced - version: ${localData.pages[pageId].version}`);
              } else {
                console.warn(`[Sync] No local content found for page ${pageId} despite dirty flag.`);
              }
            }
          }

          // Also process dirty notebooks and folders (version increment + clear dirty)
          // Notebooks
          localData.notebooks.forEach((n: any) => {
            if (n.dirty) {
              n.version += 1;
              n.dirty = false;
              n.lastModifier = state.clientId;
              console.log(`✅ [Sync] Notebook "${n.name}" synced - version: ${n.version}`);
            }
          });

          // Folders
          Object.values(localData.folders).forEach((f: any) => {
            if (f.dirty) {
              f.version += 1;
              f.dirty = false;
              f.lastModifier = state.clientId;
              console.log(`✅ [Sync] Folder "${f.name}" synced - version: ${f.version}`);
            }
          });

          // Prepare clean data for upload (remove dirty property entirely from server copy)
          const cleanData = JSON.parse(JSON.stringify(localData));

          // Strip dirty property from all items in cleanData
          cleanData.notebooks.forEach((n: any) => delete n.dirty);
          Object.values(cleanData.folders).forEach((f: any) => delete f.dirty);
          Object.values(cleanData.pages).forEach((p: any) => delete p.dirty);

          // 🛡️ SAFETY CHECK: Re-verify remote state before committing
          // This prevents "lost updates" if another client synced while we were processing.
          if (remoteMetaFile) {
            const freshContentResponse = await (window as any).gapi.client.drive.files.get({
              fileId: remoteMetaFile.id,
              alt: 'media'
            });
            const freshRemoteData = typeof freshContentResponse.body === 'string'
              ? JSON.parse(freshContentResponse.body)
              : freshContentResponse.result;

            // Check if any notebook version advanced on server
            const hasRemoteChanged = freshRemoteData.notebooks?.some((n: any) => {
              const original = remoteData.notebooks?.find((on: any) => on.id === n.id);
              if (!original) {
                console.warn(`[Safety Check] New notebook found on server: ${n.name}`);
                return true;
              }
              if (n.version > original.version) {
                console.warn(`[Safety Check] Notebook version mismatch: Server=${n.version}, Snapshot=${original.version}`);
                return true;
              }
              return false;
            }) || (freshRemoteData.notebooks?.length !== remoteData.notebooks?.length);

            // Also check pages
            const hasPagesChanged = Object.values(freshRemoteData.pages || {}).some((p: any) => {
              const original = remoteData.pages?.[p.id];
              if (!original) {
                // New page on server?
                // If we didn't see it in snapshot, it's a change.
                return true;
              }
              if (p.version > original.version) {
                console.warn(`[Safety Check] Page version mismatch '${p.name}': Server=${p.version}, Snapshot=${original.version}`);
                return true;
              }
              return false;
            });

            if (hasRemoteChanged || hasPagesChanged) {
              console.error('❌ Safety Check Failed: Remote state advanced during sync.');
              throw new Error('Remote changes detected during sync. Please try again to resolve conflicts.');
            }
          }

          // Update metadata on Drive with new versions (and NO dirty flags)
          await googleDrive.updateFile(remoteMetaFile.id, JSON.stringify(cleanData));

          // Update local store with new versions and cleared dirty flags
          fsStore.mergeRemoteData(localData);

          console.log(`✅ [Sync] Push complete - ${pagesToUpload.length} page(s) synced\n`);

        } else if (needsPush && needsPull) {
          set({ status: 'conflict', conflicts: { localData, remoteData } });
          toast.warning('Changes on both sides. Manual resolution required.');
          return;
        }
      } else {
        console.log('📤 [Sync] Initial upload to empty Drive folder...');

        // Create a working copy for local updates
        const updatedLocalData = JSON.parse(JSON.stringify(localData));

        // Prepare clean data for server upload (remove dirty property from server copy)
        const serverData = JSON.parse(JSON.stringify(updatedLocalData));

        // Strip dirty flags for server
        serverData.notebooks.forEach((n: any) => delete n.dirty);
        Object.values(serverData.folders).forEach((f: any) => delete f.dirty);
        Object.values(serverData.pages).forEach((p: any) => delete p.dirty);

        await googleDrive.createFile('metadata.json', JSON.stringify(serverData), 'application/json', rootId || '');

        // Initial upload of all pages
        const pageIds = Object.keys(updatedLocalData.pages);

        for (const pageId of pageIds) {
          const filename = `page-${pageId}.tldr`;
          const content = await opfs.loadFile(filename);

          if (content) {
            console.log(`  📄 Uploading new page "${updatedLocalData.pages[pageId].name}"...`);
            await googleDrive.createFile(filename, content, 'application/json', rootId!);

            // Mark as clean in our local copy
            updatedLocalData.pages[pageId].dirty = false;
          } else {
            console.warn(`[Sync] ⚠️ Could not find content for page ${pageId} (${updatedLocalData.pages[pageId].name}) at ${filename}`);
          }
        }

        // Mark all other items as clean in our local copy
        updatedLocalData.notebooks.forEach((n: any) => n.dirty = false);
        Object.values(updatedLocalData.folders).forEach((f: any) => f.dirty = false);

        // Save clean state locally
        fsStore.mergeRemoteData(updatedLocalData);

        console.log('✅ [Sync] Initial upload complete');
      }

      set({ lastSync: Date.now(), status: 'idle' });
      if (manual) toast.success('Sync complete');
    } catch (err: any) {
      console.error(err);

      // Auto-retry on Safe Check abort
      if (err.message && err.message.includes('Remote changes detected')) {
        console.log('🔄 Auto-retrying sync due to remote changes...');
        toast('Remote changed, refreshing...', { duration: 2000 });
        set({ status: 'idle', error: null }); // Reset status

        // Short delay then retry
        setTimeout(() => {
          get().sync(manual);
        }, 500);
        return;
      }

      // Token expired?
      if (err.status === 401 || err.result?.error?.code === 401) {
        console.warn('🔑 Token expired during sync. Attempting silent refresh...');
        googleDrive.authenticateSilent();
        set({ status: 'idle' });
        return;
      }

      set({ status: 'error', error: err.message || 'Unknown error' });
      if (manual) toast.error('Sync failed: ' + (err.message || 'Network error'));
    }
  },

  resolveConflict: async (resolution) => {
    const { conflicts, rootFolderId } = get();
    if (!conflicts || !rootFolderId) return;

    set({ status: 'syncing' });
    const fsStore = useFileSystemStore.getState();

    try {
      if (resolution === 'local') {
        const { localData, remoteData } = conflicts;

        // 1. Prepare winner data (Local changes, but with bumped versions)
        const updatedNotebooks = localData.notebooks.map((n: any) => {
          const r = remoteData.notebooks.find((rn: any) => rn.id === n.id);
          if (r && r.version >= n.version) {
            return { ...n, version: r.version + 1, dirty: false, lastModifier: get().clientId };
          }
          return { ...n, dirty: false, lastModifier: get().clientId };
        });

        const updatedPages: Record<string, any> = {};
        for (const [id, page] of Object.entries(localData.pages)) {
          const p = page as any;
          const r = remoteData.pages[id];
          if (r && r.version >= p.version) {
            updatedPages[id] = { ...p, version: r.version + 1, dirty: false, lastModifier: get().clientId };
          } else {
            updatedPages[id] = { ...p, dirty: false, lastModifier: get().clientId };
          }
        }

        const validMeta = {
          ...localData,
          notebooks: updatedNotebooks,
          pages: updatedPages,
          // Folders logic omitted for brevity, assuming similar structure or no conflicts typically
          folders: localData.folders
        };

        // 2. Upload Metadata
        const remoteMetaFile = await googleDrive.findFileByName('metadata.json', rootFolderId);
        if (remoteMetaFile) {
          await googleDrive.updateFile(remoteMetaFile.id, JSON.stringify(validMeta));
        }

        // 3. Upload Content (using correct extension)
        for (const pageId in updatedPages) {
          // We only need to upload pages that were actually dirty/conflicting
          // But for safety in "Keep Local" we can upload all dirty ones.
          // Optimization: Check original dirty flag.
          if (localData.pages[pageId].dirty) {
            const content = await opfs.loadFile(`page-${pageId}.tldr`);
            if (content) {
              // Try .tldr first, then .json
              let existing = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootFolderId);
              if (!existing) existing = await googleDrive.findFileByName(`${pageId}.json`, rootFolderId);

              if (existing) await googleDrive.updateFile(existing.id, content);
              else await googleDrive.createFile(`page-${pageId}.tldr`, content, 'application/json', rootFolderId);

              console.log(`[Sync] Uploaded conflict resolution for page ${pageId}`);
            }
          }
        }

        // 4. Update Local Store
        fsStore.mergeRemoteData(validMeta); // This sets versions and clears dirty implicitly if we pass validMeta
        // Manually ensure dirty flags are clear (merge might overwrite)
        fsStore.clearDirtyFlags();

      } else {
        // Use Remote (Discard local changes)
        console.log('[Sync] Resolving using REMOTE version.');

        // 1. Download all pages first (so disk has new content)
        for (const pageId in conflicts.remoteData.pages) {
          // Try .tldr first, then .json
          let driveFile = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootFolderId);
          if (!driveFile) driveFile = await googleDrive.findFileByName(`${pageId}.json`, rootFolderId);

          if (driveFile) {
            // @ts-ignore
            const contentResponse = await gapi.client.drive.files.get({ fileId: driveFile.id, alt: 'media' });
            const content = typeof contentResponse.body === 'string' ? contentResponse.body : JSON.stringify(contentResponse.result);
            // Always save as .tldr locally
            await opfs.saveFile(`page-${pageId}.tldr`, content);
            console.log(`[Sync] Downloaded remote content for page ${pageId}`);
          }
        }

        // 2. Update Local Store (Triggers UI Reload)
        fsStore.mergeRemoteData(conflicts.remoteData);

        // Force save metadata to disk
        fsStore.save();
      }

      set({ status: 'idle', conflicts: null, lastSync: Date.now() });
      toast.success('Conflict resolved');
    } catch (err: any) {
      toast.error('Failed to resolve conflict: ' + err.message);
      set({ status: 'error' });
    }
  },

  logout: async (deleteData = false) => {
    if (deleteData && get().rootFolderId) {
      try {
        await googleDrive.deleteFile(get().rootFolderId!);
        toast.success('Data deleted from Google Drive');
      } catch (e) {
        toast.error('Could not delete data from Drive');
      }
    }
    await googleDrive.signOut();
    set({ isConfigured: false, rootFolderId: null, isEnabled: false, user: null });
    localStorage.removeItem('cuaderno-drive-root-id');
    localStorage.removeItem('cuaderno-drive-token');
    localStorage.removeItem('cuaderno-user-info');
    localStorage.setItem('cuaderno-sync-enabled', 'false');
    localStorage.removeItem('cuaderno-sync-enabled');
  }
}));
