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
  isClientReady: boolean; // Is GAPI client loaded?
  error: string | null;
  rootFolderId: string | null;
  conflicts: any | null; // Stores { localData, remoteData }
  user: { name: string; photo: string } | null;
  expiresAt: number | null;
  isLoginDialogOpen: boolean;

  // Actions
  setClientId: (id: string) => void;
  setLoginDialogOpen: (open: boolean) => void;
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
  checkTokenValidity: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  clientId: '',
  status: 'idle',
  lastSync: null,
  isEnabled: localStorage.getItem('cuaderno-sync-enabled') === 'true',
  isConfigured: !!localStorage.getItem('cuaderno-drive-token'),
  isClientReady: false,
  error: null,
  rootFolderId: localStorage.getItem('cuaderno-drive-root-id'),
  conflicts: null,
  user: JSON.parse(localStorage.getItem('cuaderno-user-info') || 'null'),
  expiresAt: Number(localStorage.getItem('cuaderno-drive-expires-at')) || null,
  isLoginDialogOpen: false,

  setClientId: (clientId: string) => set({ clientId }),
  setLoginDialogOpen: (isLoginDialogOpen: boolean) => set({ isLoginDialogOpen }),
  setStatus: (status: SyncStatus) => set({ status }),
  setLastSync: (lastSync: number) => set({ lastSync }),
  setIsEnabled: (isEnabled: boolean) => {
    localStorage.setItem('cuaderno-sync-enabled', String(isEnabled));
    set({ isEnabled });
    if (isEnabled) {
      get().sync();
    }
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
    googleDrive.init(async (response: any) => {
      const token = response.access_token;
      const expiresIn = response.expires_in; // seconds
      const expiresAt = Date.now() + (expiresIn * 1000);

      const isRefreshing = !!localStorage.getItem('cuaderno-drive-token');
      localStorage.setItem('cuaderno-drive-token', token);
      localStorage.setItem('cuaderno-drive-expires-at', String(expiresAt));
      set({ expiresAt });

      await get().setupConnection(token, isRefreshing);
      // If we succeed, ensure dialog is closed
      set({ isLoginDialogOpen: false });
    }, (error: any) => {
      console.error('Google Auth Error:', error);
      toast.error('Google Auth Error: ' + (error.error || 'Unknown error'));
      // If silent refresh fails (or any other auth error while we thought we were connected)
      // we must clear the session to break the loop.
      if (get().isConfigured) {
        console.warn('Silent refresh failed or session expired.');
        localStorage.removeItem('cuaderno-drive-token');
        localStorage.removeItem('cuaderno-drive-expires-at');
        localStorage.removeItem('cuaderno-user-info');
        set({ isConfigured: false, user: null, expiresAt: null });
        toast.error('Session expired. Please log in again.');
      }
    }).then(async () => {
      // Library is ready. Check if we have a stored token to restore session.
      const storedToken = localStorage.getItem('cuaderno-drive-token');
      // Always try to restore connection if we have a token, even if state says configured (optimistic)
      if (storedToken) {
        await get().setupConnection(storedToken, true);
      }
      set({ isClientReady: true });
    });
  },

  setupConnection: async (token: string, silent = false) => {
    set({ isConfigured: true });
    try {
      if (token) {
        await googleDrive.setToken(token);
      }
      const userInfo = await googleDrive.getUserInfo();

      if (!userInfo || !userInfo.name) {
        throw new Error('Invalid user info received');
      }

      const user = { name: userInfo.name, photo: userInfo.picture };

      localStorage.setItem('cuaderno-user-info', JSON.stringify(user));
      set({ user });

      if (!silent) toast.success('Connected to Google Drive');
      // Trigger initial sync if enabled OR if this is a manual login (not silent restoration)
      if (get().isEnabled || !silent) {
        // Ensure client is ready before syncing
        set({ isClientReady: true });
        get().sync(!silent); // manual=true if it was a real login
      }
    } catch (e) {
      console.error('Failed to restore session or fetch user info', e);
      // If token expired, try silent refresh
      if ((e as any).status === 401 || (e as any).result?.error?.code === 401) {
        console.warn('🔑 Token expired. Clearing session and attempting silent refresh...');

        // 1. Clear invalid session immediately so UI reflects "disconnected" (or pending)
        localStorage.removeItem('cuaderno-drive-token');
        localStorage.removeItem('cuaderno-drive-expires-at');
        // We keep user info briefly or clear it? Better to clear to be safe.
        // localStorage.removeItem('cuaderno-user-info'); 

        // 2. Open Dialog so user knows what happened if silent refresh fails
        set({ isConfigured: false, isLoginDialogOpen: true });

        // 3. Attempt Silent Refresh
        googleDrive.authenticateSilent();
      } else {
        localStorage.removeItem('cuaderno-drive-token');
        localStorage.removeItem('cuaderno-drive-expires-at');
        localStorage.removeItem('cuaderno-user-info');
        set({ isConfigured: false, user: null, expiresAt: null });
        if (!silent) toast.error('Failed to connect to Google Drive.');
      }
    }
  },

  authenticate: async (prompt: 'consent' | 'select_account' | 'none' = 'select_account') => {
    await googleDrive.authenticate(prompt);
  },

  sync: async (manual = false) => {
    let state = get();

    // Auto-wait for client readiness if manual
    if (manual && state.isConfigured && !state.isClientReady) {
      console.log('⏳ [Sync] Waiting for Drive Client initialization...');
      const start = Date.now();
      while (!get().isClientReady) {
        if (Date.now() - start > 10000) {
          toast.error('Sync failed: Drive Client timeout.');
          return;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      state = get(); // Update state ref
    }

    if (!state.isConfigured || state.status !== 'idle') return;
    if (!state.isClientReady) return; // Silent return for auto-sync if not ready

    // @ts-expect-error - GAPI types are incomplete
    if (!gapi.client.drive) {
      console.warn('[Sync] Drive API not loaded. Attempting re-initialization...');
      try {
        await get().initialize();
        // Wait a bit just in case
        await new Promise(r => setTimeout(r, 1000));

        // Check again
        // @ts-expect-error - GAPI types are incomplete
        if (!gapi.client.drive) {
          throw new Error('Drive API still not loaded after re-init');
        }
        console.log('[Sync] Drive API recovered successfully.');
      } catch (e: any) {
        console.error('[Sync] Drive API initialization recovery failed:', e);
        set({ status: 'error', error: 'Drive API not loaded' });
        if (manual) toast.error('Sync failed: Drive API not loaded. Please try refreshing the page.');
        return;
      }
    }

    try {
      set({ status: 'saving-to-disk' });
      // Always force save active page content to ensure we upload latest changes
      const fsStore = useFileSystemStore.getState();
      if (fsStore.forceSaveActivePage) {
        console.log('[Sync] Forcing save of active page content...');
        await fsStore.forceSaveActivePage();
      }
      await fsStore.save();

      set({ status: 'syncing' });

      // 1. Ensure Root Folder
      let rootId = state.rootFolderId;

      // Validate existing rootId
      if (rootId) {
        try {
          await googleDrive.getFileMetadata(rootId);
        } catch (e) {
          console.warn('[Sync] Stale Root Folder ID detected (404/Trashed). Resetting...', e);
          rootId = null;
          set({ rootFolderId: null });
          localStorage.removeItem('cuaderno-drive-root-id');
        }
      }

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

      // Helper to deduplicate local notebooks before processing
      const deduplicateItems = <T extends { id: string, version: number, dirty?: boolean }>(items: T[]): T[] => {
        const map = new Map<string, T>();
        items.forEach(item => {
          const existing = map.get(item.id);
          if (!existing || (item.dirty && !existing.dirty) || (item.version > existing.version)) {
            map.set(item.id, item);
          }
        });
        return Array.from(map.values());
      };

      const localData = JSON.parse(JSON.stringify({
        notebooks: deduplicateItems(fsStore.notebooks),
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
        // @ts-expect-error - GAPI types are incomplete for media downloads
        const remoteContentResponse = await gapi.client.drive.files.get({
          fileId: remoteMetaFile.id,
          alt: 'media'
        });
        const remoteData = typeof remoteContentResponse.body === 'string' ? JSON.parse(remoteContentResponse.body) : (remoteContentResponse.result || remoteContentResponse.body);

        // 3. Conflict Detection & Granular Categorization
        // 3. Conflict Detection & Granular Categorization
        const safePulls: { type: 'notebook' | 'folder' | 'page', id: string, version: number }[] = [];
        const safePushes: { type: 'notebook' | 'folder' | 'page', id: string }[] = [];
        const conflictsList: { type: 'notebook' | 'folder' | 'page', id: string, localVersion: number, remoteVersion: number }[] = [];
        const localDeletions: { type: 'notebook' | 'folder' | 'page', id: string }[] = [];

        const hasRemoteData = (remoteData.notebooks?.length > 0) || (Object.keys(remoteData.pages || {}).length > 0);

        // Helper to categorize items
        const checkItem = (type: 'notebook' | 'folder' | 'page', local: any, remote: any) => {
          if (local.isPlaceholder) {
            // Special handling for Placeholders: Only delete if strictly untouched
            let keepPlaceholder = false;

            // 1. If the item itself is modified, keep it (it's now user content)
            if (local.dirty) {
              keepPlaceholder = true;
            }
            // 2. If it's a container (Notebook/Folder), check if it contains user content
            else if (type === 'notebook' || type === 'folder') {
              const checkDescendants = (parentId: string): boolean => {
                const childFolders = Object.values(localData.folders).filter((f: any) => f.parentId === parentId);
                const childPages = Object.values(localData.pages).filter((p: any) => p.parentId === parentId);

                for (const p of childPages) {
                  const cp = p as any;
                  if (cp.dirty || !cp.isPlaceholder) return true; // User created or modified page
                }
                for (const f of childFolders) {
                  const cf = f as any;
                  if (cf.dirty || !cf.isPlaceholder) return true; // User modified folder
                  if (checkDescendants(cf.id)) return true; // Recursive check
                }
                return false;
              };

              if (checkDescendants(local.id)) {
                keepPlaceholder = true;
                // Valid use case: User added a page to "Welcome" notebook, but didn't rename the notebook.
                // The notebook is clean, but we MUST push it so the page has a parent.
                // We force it to be dirty for this sync cycle.
                local.dirty = true;
              }
            }

            if (!keepPlaceholder && hasRemoteData) {
              // If remote has data, we assume this is an existing user.
              // Since our placeholder is untouched and contains nothing of value, delete it.
              console.log(`🗑️ [Sync] Deleting local placeholder ${type} ${local.id} as remote has data.`);
              localDeletions.push({ type, id: local.id });
              return;
            }

            // If we descend here, we are keeping it. 
            // If it was "Clean" but kept (e.g. because it's a new user and hasRemoteData is false),
            // it will fall through.
            // If it was "Dirty" (modified), it falls through to standard dirty check below.
          }

          if (remote) {
            // Remote exists
            const isRemoteAhead = remote.version > local.version;
            const isLocalChanged = local.dirty;
            const isDifferentModifier = remote.lastModifier !== state.clientId;

            if (isRemoteAhead && isLocalChanged && isDifferentModifier) {
              // True Conflict: Both changed independently
              console.log(`⚔️ [Sync] Conflict detected for ${type} ${local.id}: Local v${local.version} (dirty) vs Remote v${remote.version}`);
              conflictsList.push({ type, id: local.id, localVersion: local.version, remoteVersion: remote.version });
            } else if (isRemoteAhead) {
              // Remote moved ahead, we are clean
              console.log(`⬇️ [Sync] Safe Pull for ${type} ${local.id}: Local v${local.version} -> Remote v${remote.version}`);
              safePulls.push({ type, id: local.id, version: remote.version });
            } else if (isLocalChanged) {
              // We changed, remote is same version (or older)
              console.log(`⬆️ [Sync] Safe Push for ${type} ${local.id}: Local v${local.version} (dirty) -> Remote v${remote.version}`);
              safePushes.push({ type, id: local.id });
            }
          } else {
            // Remote missing.
            // If we have it and it's dirty, it's a NEW creation -> Push
            if (local.dirty) {
              safePushes.push({ type, id: local.id });
            }
            // If we have it and it's clean, but remote doesn't... it might have been deleted on remote?
            // That's handled by 'deletedItemIds' usually. If not in deleted list, maybe we just haven't synced it yet?
            // Or we deleted it? No, if we have it, we have it.
            // If it's not in remote and not dirty, we probably just haven't pushed it, OR it was deleted remotely.
            // Assuming deletions are tombstoned, if it's not tombstoned and missing remote, we push (re-create/sync).
            else {
              // Optional: Auto-healing? For now, ignore unless dirty.
            }
          }
        };

        // Check Items
        localData.notebooks.forEach((n: any) => checkItem('notebook', n, remoteData.notebooks.find((rn: any) => rn.id === n.id)));
        Object.values(localData.folders).forEach((f: any) => checkItem('folder', f, remoteData.folders[f.id]));
        Object.values(localData.pages).forEach((p: any) => checkItem('page', p, remoteData.pages[p.id]));

        // Check for Remote-Only items (New items created elsewhere)
        // Notebooks
        remoteData.notebooks.forEach((rn: any) => {
          if (!localData.notebooks.find((n: any) => n.id === rn.id)) {
            // Only pull if NOT deleted locally
            if (!localData.deletedItemIds.includes(rn.id)) {
              safePulls.push({ type: 'notebook', id: rn.id, version: rn.version });
            }
          }
        });
        // Folders
        Object.values(remoteData.folders).forEach((rf: any) => {
          if (!localData.folders[(rf as any).id]) {
            if (!localData.deletedItemIds.includes((rf as any).id)) {
              safePulls.push({ type: 'folder', id: (rf as any).id, version: (rf as any).version });
            }
          }
        });
        // Pages
        Object.values(remoteData.pages).forEach((rp: any) => {
          if (!localData.pages[(rp as any).id]) {
            if (!localData.deletedItemIds.includes((rp as any).id)) {
              safePulls.push({ type: 'page', id: (rp as any).id, version: (rp as any).version });
            }
          }
        });

        // 4. Tombstones (Deletions)
        const remoteTombstones = remoteData.deletedItemIds || [];
        if (remoteTombstones.length > 0) {
          // Apply deletions immediately to local memory state before merging
          // This counts as a "Pull" action effectively
          console.log('[Sync] Processing remote deletions:', remoteTombstones);
          // (Merging logic in mergeRemoteData handles this partly, but we should respect it during categorizing if we wanted to be strict)
          // For now, let's allow the merge step to handle it.
        }

        console.log('\n📊 [Sync] Granular Analysis:');
        console.log(`  ⬇️ To Pull: ${safePulls.length} items`, safePulls.length > 0 ? JSON.stringify(safePulls) : '');
        console.log(`  ⬆️ To Push: ${safePushes.length} items`, safePushes.length > 0 ? JSON.stringify(safePushes) : '');
        console.log(`  ⚔️ Conflicts: ${conflictsList.length} items`, conflictsList.length > 0 ? JSON.stringify(conflictsList) : '');

        // 5. AUTO-EXECUTION: Process Safe Pulls
        if (safePulls.length > 0) {
          console.log('[Sync] Processing safe downloads...');

          // Download content for Pages in the pull list
          const pagesToPull = safePulls.filter(i => i.type === 'page');
          for (const item of pagesToPull) {
            const pageId = item.id;

            // Safety check: ensure it wasn't flagged as conflict (logic above shouldn't allow this, but double check)
            if (conflictsList.find(c => c.id === pageId)) continue;

            console.log(`[Sync] Downloading page ${pageId}...`);
            const driveFile = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootId!) || await googleDrive.findFileByName(`${pageId}.json`, rootId!);

            if (driveFile) {
              // @ts-expect-error - GAPI types are incomplete for media downloads
              const contentResponse = await gapi.client.drive.files.get({ fileId: driveFile.id, alt: 'media' });
              const content = typeof contentResponse.body === 'string' ? contentResponse.body : JSON.stringify(contentResponse.result);
              await opfs.saveFile(`page-${pageId}.tldr`, content);
              console.log(`[Sync] Page ${pageId} saved to disk.`);
            }
          }

          // Apply Metadata Changes to localData immediately for Safe Pulls
          safePulls.forEach(p => {
            // If it's a conflict, DO NOT overwrite local yet. Only safe ones.
            if (conflictsList.find(c => c.id === p.id)) return;

            if (p.type === 'notebook') {
              const r = remoteData.notebooks.find((x: any) => x.id === p.id);
              const existingIdx = localData.notebooks.findIndex((x: any) => x.id === p.id);
              if (existingIdx >= 0) localData.notebooks[existingIdx] = r;
              else localData.notebooks.push(r);
            } else if (p.type === 'folder') {
              localData.folders[p.id] = remoteData.folders[p.id];
            } else if (p.type === 'page') {
              localData.pages[p.id] = remoteData.pages[p.id];
            }
          });
        }

        // 5a. Process Local Placeholders Deletions (Conflict Avoidance)
        if (localDeletions.length > 0) {
          console.log(`🗑️ [Sync] Executing ${localDeletions.length} local placeholder deletions...`);
          localDeletions.forEach(d => {
            // Remove from localData immediately so it doesn't get merged/pushed later
            if (d.type === 'notebook') {
              localData.notebooks = localData.notebooks.filter((n: any) => n.id !== d.id);
            } else if (d.type === 'folder') {
              delete localData.folders[d.id];
            } else if (d.type === 'page') {
              delete localData.pages[d.id];
            }
            // Note: We don't add to deletedItemIds because we don't want to tell the server we deleted it 
            // (it never existed there). We just vanish it locally.
          });
        }

        // 6. AUTO-EXECUTION: Process Safe Pushes
        // We only push if we are NOT in a critical metadata conflict that prevents saving the manifest.
        // But since we are merging, we can attempt to push the files for our safe items.
        if (safePushes.length > 0) {
          console.log('[Sync] Processing safe uploads...');
          const pagesToPush = safePushes.filter(i => i.type === 'page');

          for (const item of pagesToPush) {
            const pageId = item.id;
            // Safety check
            if (conflictsList.find(c => c.id === pageId)) continue;

            const page = localData.pages[pageId];
            if (page && page.dirty) {
              console.log(`  📄 Uploading page "${page.name}" (${pageId})...`);
              const content = await opfs.loadFile(`page-${pageId}.tldr`);
              if (content) {
                const existing = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootId!) || await googleDrive.findFileByName(`${pageId}.json`, rootId!);
                if (existing) await googleDrive.updateFile(existing.id, content);
                else await googleDrive.createFile(`page-${pageId}.tldr`, content, 'application/json', rootId!);

                // Update our local in-memory knowledge of what we just pushed, 
                // so the final metadata merge reflects strictly verified state?
                // Actually, we must update the `localData` object version so the final metadata push includes the new version.

                // Clear placeholder flag (Promotion)
                delete localData.pages[pageId].isPlaceholder;
                localData.pages[pageId].version += 1;
                localData.pages[pageId].dirty = false;
                localData.pages[pageId].lastModifier = state.clientId;

                // Signal to the UI that WE authored this version (prevents unnecessary reload)
                useFileSystemStore.getState().recordSelfPush(pageId, localData.pages[pageId].version);
              }
            }
          }

          // Apply version bumps to safe Notebooks/Folders for the metadata push
          safePushes.filter(i => i.type === 'notebook' && !conflictsList.find(c => c.id === i.id)).forEach(i => {
            const n = localData.notebooks.find((x: any) => x.id === i.id);
            if (n) {
              delete n.isPlaceholder; // Clear placeholder flag
              n.version += 1;
              n.dirty = false;
              n.lastModifier = state.clientId;
            }
          });
          safePushes.filter(i => i.type === 'folder' && !conflictsList.find(c => c.id === i.id)).forEach(i => {
            const f = localData.folders[i.id];
            if (f) {
              delete f.isPlaceholder; // Clear placeholder flag
              f.version += 1;
              f.dirty = false;
              f.lastModifier = state.clientId;
            }
          });
        }

        // 7. Finalize Merge & Metadata Update
        if (conflictsList.length === 0) {
          // No true conflicts. We can safely merge metadata and push the final result.
          console.log('[Sync] Merging metadata and finalizing sync...');

          // Apply remote changes to localData (This mimics "Pulling" the metadata)
          // If we downloaded files, we need the metadata to match.
          // For items that were Pushed, localData already has the bump.
          // For items that were Pulled, we must copy over the remote info.

          safePulls.forEach(p => {
            if (p.type === 'notebook') {
              const r = remoteData.notebooks.find((x: any) => x.id === p.id);
              const existingIdx = localData.notebooks.findIndex((x: any) => x.id === p.id);
              if (existingIdx >= 0) localData.notebooks[existingIdx] = r;
              else localData.notebooks.push(r);
            } else if (p.type === 'folder') {
              localData.folders[p.id] = remoteData.folders[p.id];
            } else if (p.type === 'page') {
              localData.pages[p.id] = remoteData.pages[p.id];
            }
          });

          // Handle tombstones
          if (remoteTombstones.length > 0) {
            console.log('[Sync] Applying remote deletions to metadata...');
            const tombstoneSet = new Set(remoteTombstones);
            localData.notebooks = localData.notebooks.filter((n: any) => !tombstoneSet.has(n.id));

            remoteTombstones.forEach((kid: string) => {
              delete localData.folders[kid];
              delete localData.pages[kid];
            });

            const localTombstones = localData.deletedItemIds || [];
            console.log('[Sync] Debug - Merging Tombstones. Local:', localTombstones.length, 'Remote:', remoteTombstones.length);

            // Merge unique IDs safely
            localData.deletedItemIds = Array.from(new Set([...localTombstones, ...remoteTombstones]));
            console.log('[Sync] Debug - Merged Result:', localData.deletedItemIds.length);
          }

          // Now localData implies the "Merged State".
          // If we pushed anything, we need to upload this new metadata to remote.
          // If we only pulled, we technically don't need to push metadata, but it doesn't hurt to sync active state.

          // Clean dirty flags again just in case (for the upload)
          const cleanData = JSON.parse(JSON.stringify(localData));
          cleanData.notebooks.forEach((n: any) => delete n.dirty);
          Object.values(cleanData.folders).forEach((f: any) => delete f.dirty);
          Object.values(cleanData.pages).forEach((p: any) => delete p.dirty);

          // Active State Sync logic (Last modifier wins) - Only if no conflicts
          const localActiveUpdatedAt = fsStore.activeStateUpdatedAt || 0;
          const remoteActiveUpdatedAt = remoteData.activeStateUpdatedAt || 0;

          if (localActiveUpdatedAt > remoteActiveUpdatedAt) {
            cleanData.activeNotebookId = fsStore.activeNotebookId;
            cleanData.activePageId = fsStore.activePageId;
            cleanData.activePath = fsStore.activePath;
            cleanData.activeStateUpdatedAt = fsStore.activeStateUpdatedAt;
            cleanData.activeStateModifier = state.clientId;
          }

          // PUSH Metadata if we made changes OR if we just want to update active state OR if deletions occurred
          const hasNewDeletions = (localData.deletedItemIds || []).length > (remoteData.deletedItemIds || []).length;

          if (safePushes.length > 0 || localActiveUpdatedAt > remoteActiveUpdatedAt || hasNewDeletions) {
            console.log('[Sync] Pushing updated metadata to server...');
            await googleDrive.updateFile(remoteMetaFile.id, JSON.stringify(cleanData));
            console.log('[Sync] Metadata updated on server.');
          }

          console.log('[Sync] Committing to local store...');
          // Commit to Local Store
          fsStore.mergeRemoteData(localData);
          set({ lastSync: Date.now(), status: 'idle' });
          console.log('[Sync] Sync process finished successfully.');
          if (manual) toast.success('Sync complete');

        } else {
          // 🛑 Conflicts Exist!
          console.warn(`[Sync] ${conflictsList.length} conflicts remain. Entering conflict mode.`);

          // We have already processed safe files and updated `localData` in memory with safe merges.
          // We need to construct a "Smart Remote" data object that includes our safe local pushes 
          // so that if user chooses "Keep Remote" for the conflicted item, they don't lose the safe pushes.

          const smartRemoteData = JSON.parse(JSON.stringify(remoteData));

          // Inject safe pushes into smartRemoteData
          safePushes.forEach(p => {
            if (conflictsList.find(c => c.id === p.id)) return;
            if (p.type === 'notebook') {
              const n = localData.notebooks.find((x: any) => x.id === p.id);
              if (n) {
                const cleanN = { ...n, dirty: false };
                smartRemoteData.notebooks.push(cleanN);
              }
            } else if (p.type === 'folder') {
              const f = localData.folders[p.id];
              if (f) smartRemoteData.folders[p.id] = { ...f, dirty: false };
            } else if (p.type === 'page') {
              const pg = localData.pages[p.id];
              if (pg) smartRemoteData.pages[p.id] = { ...pg, dirty: false };
            }
          });


          console.log('Sets conflict state with partial merge.', { conflictsList });

          // Commit partial merge to FileSystem so user sees safe updates immediately
          console.log('[Sync] Committing partial merge to local store...');
          fsStore.mergeRemoteData(localData);

          set({ status: 'conflict', conflicts: { localData, remoteData: smartRemoteData } });
          toast.warning('Conflicts detected. Please resolve manually.');
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
        set({ lastSync: Date.now(), status: 'idle' });
        if (manual) toast.success('Sync complete');
      }
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
      toast.error('Sync failed: ' + (err.message || 'Network error'));
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

        // 1. Prepare winner data surgically
        const updatedNotebooks = localData.notebooks.map((n: any) => {
          const r = remoteData.notebooks.find((rn: any) => rn.id === n.id);
          const isDirty = n.dirty;

          if (r && r.version > n.version) {
            if (isDirty) {
              // CONFLICT: We both changed. We win -> Force version hike
              return { ...n, version: r.version + 1, dirty: false, lastModifier: get().clientId };
            } else {
              // SAFE PULL: We didn't change this. Accept remote.
              return { ...r, dirty: false };
            }
          }
          return { ...n, dirty: false, lastModifier: get().clientId };
        });

        // Folders
        const updatedFolders: Record<string, any> = {};
        const folderIds = new Set([...Object.keys(localData.folders), ...Object.keys(remoteData.folders)]);
        for (const id of folderIds) {
          const l = localData.folders[id];
          const r = remoteData.folders[id];
          if (l && r && r.version > l.version) {
            if (l.dirty) updatedFolders[id] = { ...l, version: r.version + 1, dirty: false, lastModifier: get().clientId };
            else updatedFolders[id] = { ...r, dirty: false };
          } else if (l) {
            updatedFolders[id] = { ...l, dirty: false, lastModifier: get().clientId };
          } else if (r) {
            updatedFolders[id] = { ...r, dirty: false };
          }
        }

        const updatedPages: Record<string, any> = {};
        const pagesToDownload: string[] = [];

        const pageIds = new Set([...Object.keys(localData.pages), ...Object.keys(remoteData.pages)]);
        for (const id of pageIds) {
          const p = localData.pages[id];
          const r = remoteData.pages[id];

          if (p && r && r.version > p.version) {
            if (p.dirty) {
              // We win
              updatedPages[id] = { ...p, version: r.version + 1, dirty: false, lastModifier: get().clientId };
            } else {
              // They win, we accept
              updatedPages[id] = { ...r, dirty: false };
              pagesToDownload.push(id);
            }
          } else if (p) {
            updatedPages[id] = { ...p, dirty: false, lastModifier: get().clientId };
          } else if (r) {
            // New page from remote
            updatedPages[id] = { ...r, dirty: false };
            pagesToDownload.push(id);
          }
        }

        const validMeta = {
          ...localData,
          notebooks: updatedNotebooks,
          folders: updatedFolders,
          pages: updatedPages
        };

        // 2. Download content for pages we accepted from remote
        for (const pageId of pagesToDownload) {
          let driveFile = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootFolderId);
          if (!driveFile) driveFile = await googleDrive.findFileByName(`${pageId}.json`, rootFolderId);
          if (driveFile) {
            // @ts-ignore
            const contentResponse = await gapi.client.drive.files.get({ fileId: driveFile.id, alt: 'media' });
            const content = typeof contentResponse.body === 'string' ? contentResponse.body : JSON.stringify(contentResponse.result);
            await opfs.saveFile(`page-${pageId}.tldr`, content);
            console.log(`[Sync] Conflict Resolution: Downloaded remote page ${pageId}`);
          }
        }

        // 3. Upload Metadata
        const remoteMetaFile = await googleDrive.findFileByName('metadata.json', rootFolderId);
        if (remoteMetaFile) {
          await googleDrive.updateFile(remoteMetaFile.id, JSON.stringify(validMeta));
        }

        // 4. Upload Content for pages we kept locally (and were dirty)
        for (const pageId in updatedPages) {
          if (localData.pages[pageId]?.dirty) {
            const content = await opfs.loadFile(`page-${pageId}.tldr`);
            if (content) {
              let existing = await googleDrive.findFileByName(`page-${pageId}.tldr`, rootFolderId);
              if (!existing) existing = await googleDrive.findFileByName(`${pageId}.json`, rootFolderId);

              if (existing) await googleDrive.updateFile(existing.id, content);
              else await googleDrive.createFile(`page-${pageId}.tldr`, content, 'application/json', rootFolderId);

              console.log(`[Sync] Conflict Resolution: Uploaded local page ${pageId}`);
            }
          }
        }

        // 5. Update Local Store
        fsStore.mergeRemoteData(validMeta);
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
    set({ isConfigured: false, rootFolderId: null, isEnabled: false, user: null, expiresAt: null });
    localStorage.removeItem('cuaderno-drive-root-id');
    localStorage.removeItem('cuaderno-drive-token');
    localStorage.removeItem('cuaderno-drive-expires-at');
    localStorage.removeItem('cuaderno-user-info');
    localStorage.setItem('cuaderno-sync-enabled', 'false');
    localStorage.removeItem('cuaderno-sync-enabled');
  },

  checkTokenValidity: async () => {
    const { expiresAt, isConfigured } = get();
    if (!isConfigured) return;

    // If we are configured but have no expiresAt, it's a stale or incomplete session
    if (!expiresAt) {
      console.warn('🔑 No expiration time found for active session. Forcing dialog...');
      set({ isConfigured: false, isLoginDialogOpen: true });
      return;
    }

    // Refresh if expired or expiring in less than 5 minutes
    const buffer = 5 * 60 * 1000;
    if (Date.now() + buffer > expiresAt) {
      console.log('🔑 Token expired or close to expiration. Refreshing...');

      // If we are already in the process of refreshing/syncing, don't overlap too much
      // but ensure we try to get a fresh token.
      try {
        await googleDrive.authenticateSilent();
      } catch (e) {
        console.error('Failed silent refresh on visibility change', e);
        // If silent fails, ensure user sees the dialog
        set({ isConfigured: false, isLoginDialogOpen: true });
      }
    }
  }
}));
