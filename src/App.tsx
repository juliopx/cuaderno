import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { useFileSystemStore } from './store/fileSystemStore';
import { useSyncStore } from './store/syncStore';
import { Toaster, toast } from 'sonner';
import { ConflictModal } from './components/ConflictModal';
import { SessionExpiredDialog } from './components/SessionExpiredDialog';
import { opfs } from './lib/opfs';

function App() {
  const loadFs = useFileSystemStore((state) => state.load);
  const initSync = useSyncStore((state) => state.initialize);
  const sync = useSyncStore((state) => state.sync);
  const isEnabled = useSyncStore((state) => state.isEnabled);

  useEffect(() => {
    loadFs();
    initSync();

    // Sync language from store to i18n/DOM on mount
    const { language } = useFileSystemStore.getState();
    if (language) {
      import('./i18n').then(i18n => {
        i18n.default.changeLanguage(language);
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
      });
    }

    // Expose global debug utilities
    (window as any).cleardb = async () => {
      const confirmLocal = confirm('⚠️ DELETE LOCAL DATA? This cannot be undone.');
      if (!confirmLocal) return;

      const confirmCloud = confirm('☁️ ALSO DELETE CLOUD DATA? This changes "Sync" to a fresh state (requires re-login).');

      if (confirmCloud) {
        console.log('☁️ Deleting cloud data...');
        try {
          await useSyncStore.getState().logout(true);
          console.log('✅ Cloud data deleted');
        } catch (e) {
          console.error('❌ Failed to delete cloud data', e);
        }
      }

      console.log('🗑️ Clearing database...');
      const result = await opfs.clearAll();

      if (result.success) {
        console.log(`✅ Deleted ${result.deletedCount} files`);
        console.log('🔄 Reloading page...');
        window.location.reload();
      }

      return result;
    };

    (window as any).showLocalChanges = () => {
      const state = useFileSystemStore.getState();

      const dirtyNotebooks = state.notebooks.filter(n => n.dirty);
      const dirtyFolders = Object.values(state.folders).filter((f: any) => f.dirty);
      const dirtyPages = Object.values(state.pages).filter((p: any) => p.dirty);

      const totalDirty = dirtyNotebooks.length + dirtyFolders.length + dirtyPages.length;

      if (totalDirty === 0) {
        console.log('✅ No local changes - everything is synced');
        return;
      }

      console.log(`\n🔶 Local Changes (${totalDirty} items pending sync):\n`);

      if (dirtyNotebooks.length > 0) {
        console.log(`📓 Notebooks (${dirtyNotebooks.length}):`);
        dirtyNotebooks.forEach(n => {
          console.log(`  - "${n.name}" (v${n.version})`);
        });
      }

      if (dirtyFolders.length > 0) {
        console.log(`\n📁 Folders (${dirtyFolders.length}):`);
        dirtyFolders.forEach((f: any) => {
          console.log(`  - "${f.name}" (v${f.version})`);
        });
      }

      if (dirtyPages.length > 0) {
        console.log(`\n📄 Pages (${dirtyPages.length}):`);
        dirtyPages.forEach((p: any) => {
          console.log(`  - "${p.name}" (v${p.version})`);
        });
      }

      console.log('');
      return { dirtyNotebooks, dirtyFolders, dirtyPages };
    };

    (window as any).showRemoteState = async () => {
      const syncState = useSyncStore.getState();

      if (!syncState.isConfigured) {
        console.error('❌ Not connected to Google Drive');
        return;
      }

      console.log('📡 Fetching remote state...');

      try {
        const rootId = syncState.rootFolderId;
        const metaFile = await (window as any).gapi.client.drive.files.list({
          q: `name='metadata.json' and '${rootId}' in parents and trashed=false`,
          fields: 'files(id, name)'
        });

        if (!metaFile.result.files || metaFile.result.files.length === 0) {
          console.log('📭 No remote data found');
          return;
        }

        const remoteContentResponse = await (window as any).gapi.client.drive.files.get({
          fileId: metaFile.result.files[0].id,
          alt: 'media'
        });

        const remoteData = typeof remoteContentResponse.body === 'string'
          ? JSON.parse(remoteContentResponse.body)
          : remoteContentResponse.result;

        console.log('\n📊 Remote State:');
        console.log(`  Notebooks: ${remoteData.notebooks?.length || 0}`);
        console.log(`  Folders: ${Object.keys(remoteData.folders || {}).length}`);
        console.log(`  Pages: ${Object.keys(remoteData.pages || {}).length}`);
        console.log(`  Tombstones: ${remoteData.deletedItemIds?.length || 0}`);
        console.log(`  📍 Active State: Notebook=${remoteData.activeNotebookId || 'null'}, Page=${remoteData.activePageId || 'null'} (Updated: ${remoteData.activeStateUpdatedAt ? new Date(remoteData.activeStateUpdatedAt).toLocaleTimeString() : 'never'})\n`);

        if (remoteData.notebooks?.length > 0) {
          console.log('📓 Notebooks:');
          remoteData.notebooks.forEach((n: any) => {
            console.log(`  - "${n.name}" (v${n.version}, order: ${n.order}) by ${n.lastModifier?.slice(0, 8)}...`);
          });
        }

        const folderCount = Object.keys(remoteData.folders || {}).length;
        if (folderCount > 0) {
          console.log('\n📁 Folders:');
          try {
            const folders = Object.values(remoteData.folders);
            folders.forEach((f: any) => {
              if (f) {
                const dirtyFlag = f.dirty ? '🔶' : '✅';
                console.log(`  ${dirtyFlag} "${f.name}" (v${f.version}) by ${f.lastModifier?.slice(0, 8)}...`);
              } else {
                console.warn('  ⚠️ Found null/undefined folder');
              }
            });
          } catch (e) {
            console.error('Error printing folders:', e);
          }
        }

        if (Object.keys(remoteData.pages || {}).length > 0) {
          console.log('\n📄 Pages:');
          Object.values(remoteData.pages).forEach((p: any) => {
            const dirtyFlag = p.dirty ? '🔶' : '✅';
            console.log(`  ${dirtyFlag} "${p.name}" (v${p.version}) by ${p.lastModifier?.slice(0, 8)}...`);
          });
        }

        console.log('');
        return remoteData;
      } catch (e) {
        console.error('❌ Error fetching remote state:', e);
      }
    };

    (window as any).showConflicts = async (predictive = true) => {
      const syncState = useSyncStore.getState();
      let conflicts = syncState.conflicts;

      if (!conflicts && predictive) {
        console.log('🔮 Predicting Conflicts (Dry Run)...');
        // Fetch remote state similarly to showRemoteState
        if (!syncState.isConfigured) {
          console.error('❌ Not connected to Google Drive');
          return;
        }

        try {
          const rootId = syncState.rootFolderId;
          const metaFile = await (window as any).gapi.client.drive.files.list({
            q: `name='metadata.json' and '${rootId}' in parents and trashed=false`,
            fields: 'files(id)'
          });

          if (metaFile.result.files?.length > 0) {
            const remoteContentResponse = await (window as any).gapi.client.drive.files.get({
              fileId: metaFile.result.files[0].id,
              alt: 'media'
            });
            const remoteData = typeof remoteContentResponse.body === 'string'
              ? JSON.parse(remoteContentResponse.body)
              : remoteContentResponse.result;

            // Prepare Local Data for comparison
            const fsState = useFileSystemStore.getState();
            const localData = {
              notebooks: fsState.notebooks,
              folders: fsState.folders,
              pages: fsState.pages,
            };

            conflicts = { localData, remoteData };
          } else {
            console.log('📭 No remote data found to conflict with.');
            return;
          }
        } catch (e) {
          console.error('Error fetching remote state for prediction:', e);
          return;
        }
      } else if (!conflicts) {
        console.log('✅ No active conflicts. Run showConflicts(true) to predict.');
        return;
      }

      if (!conflicts) return;

      console.log('\n⚔️ Conflicts Report:');

      const { localData, remoteData } = conflicts;

      // Find conflicting items
      const conflictingNotebooks = localData.notebooks.filter((l: any) => {
        const r = remoteData.notebooks.find((n: any) => n.id === l.id);
        return r && r.version > l.version && l.dirty && r.lastModifier !== syncState.clientId;
      });

      const conflictingPages = Object.values(localData.pages).filter((l: any) => {
        const r = Object.values(remoteData.pages).find((p: any) => p.id === l.id);
        return r && (r as any).version > l.version && l.dirty && (r as any).lastModifier !== syncState.clientId;
      });

      if (conflictingNotebooks.length > 0) {
        console.log('📓 Notebook Conflicts:');
        conflictingNotebooks.forEach((n: any) => {
          const r = remoteData.notebooks.find((rn: any) => rn.id === n.id);
          console.log(`  - "${n.name}"`);
          console.log(`    Local: v${n.version} (dirty)`);
          if (r) {
            console.log(`    Remote: v${r.version} (last mod: ${r.lastModifier?.slice(0, 8)})`);
          }
        });
      } else {
        console.log('  No notebook conflicts.');
      }

      if (conflictingPages.length > 0) {
        console.log('📄 Page Conflicts:');
        conflictingPages.forEach((p: any) => {
          const r = Object.values(remoteData.pages).find((rp: any) => rp.id === p.id);
          console.log(`  - "${p.name}"`);
          console.log(`    Local: v${p.version} (dirty)`);
          if (r) {
            console.log(`    Remote: v${(r as any).version} (last mod: ${(r as any).lastModifier?.slice(0, 8)})`);
          }
        });
      } else {
        console.log('  No page conflicts.');
      }

      return conflicts;
    };

    // Expose stores for debugging
    (window as any).syncStore = useSyncStore;

    (window as any).simulate401 = () => {
      console.log('🧪 Simulating 401 Unauthorized Error...');
      useSyncStore.getState().setLoginDialogOpen(true);
      // We simulates the state change that would happen
      useSyncStore.setState({ isConfigured: false, user: null, expiresAt: null });
    };

    console.log('💡 Debug utilities available:');
    console.log('  - cleardb() - Delete all local data');
    console.log('  - showLocalChanges() - View pending local changes');
    console.log('  - showRemoteState() - View remote data without downloading');
    console.log('  - showConflicts() - View active conflicts');
    console.log('  - simulate401() - Simulate session expiration dialog');
    console.log('  - fileSystemStore.getState() - View file system state');
    console.log('  - syncStore.getState() - View sync state');
  }, [loadFs, initSync]);

  useEffect(() => {
    if (!isEnabled) return;

    // 1. Background polling (for remote changes)
    // Using recursive timeout to ensure we always wait X seconds AFTER a sync completes.
    let pollingTimer: any;
    const runPolling = async () => {
      const { status } = useSyncStore.getState();
      if (status === 'idle') {
        try {
          await sync();
        } catch (e) {
          console.error('[Polling] Sync failed', e);
        }
      }
      pollingTimer = setTimeout(runPolling, 20000); // Wait 20s before next check
    };

    pollingTimer = setTimeout(runPolling, 20000);

    // 2. Reactive local sync (for local changes)
    let debounceTimer: any;
    let lastActiveUpdatedAt = useFileSystemStore.getState().activeStateUpdatedAt;
    const unsubscribe = useFileSystemStore.subscribe((state) => {
      const hasDirty = state.notebooks.some(n => n.dirty) ||
        Object.values(state.folders).some(f => f.dirty) ||
        Object.values(state.pages).some(p => p.dirty);

      const activeChanged = state.activeStateUpdatedAt !== lastActiveUpdatedAt;

      if (hasDirty || activeChanged) {
        if (activeChanged) lastActiveUpdatedAt = state.activeStateUpdatedAt;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const syncState = useSyncStore.getState();
          if (syncState.status === 'idle') {
            console.log(activeChanged ? '🔄 Triggering auto-sync due to navigation...' : '🔄 Triggering auto-sync due to local changes...');
            sync();
          }
        }, 10000); // 10 seconds of idle
      }
    });

    return () => {
      clearTimeout(pollingTimer);
      unsubscribe();
      clearTimeout(debounceTimer);
    };
  }, [isEnabled, sync]);

  // 3. Proactive Token Refresh (every 10 minutes verification)
  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(() => {
      const { isConfigured, checkTokenValidity } = useSyncStore.getState();
      if (isConfigured) {
        console.log('🔑 Periodic token validity check...');
        checkTokenValidity();
      }
    }, 1000 * 60 * 10); // Every 10 minutes

    return () => clearInterval(interval);
  }, [isEnabled]);

  // 4. Handle returning from background (check token validity)
  useEffect(() => {
    console.log('👀 Visibility/Focus effect registered. isEnabled:', isEnabled);

    const checkState = () => {
      console.log('🔍 Checking state (Triggered by:', document.visibilityState, ')');
      if (document.visibilityState === 'visible') {
        console.log('📱 App is active. Checking token validity and sync status...');
        const syncStore = useSyncStore.getState();
        
        syncStore.checkTokenValidity();

        if (syncStore.isConfigured && syncStore.status !== 'idle') {
          console.warn('[Visibility] Sync status was stuck in:', syncStore.status, '. Resetting to idle and retrying...');
          syncStore.setStatus('idle');
          syncStore.sync();
        }
      }
    };

    const handleVisibilityChange = () => {
      console.log('🔄 visibilitychange event fired:', document.visibilityState);
      checkState();
    };

    const handleFocus = () => {
      console.log('🎯 window focus event fired');
      checkState();
    };

    // Robust listeners
    document.addEventListener('visibilitychange', handleVisibilityChange, { capture: true });
    window.addEventListener('focus', handleFocus, { capture: true });
    
    // Polling fallback: check every 30 seconds even if events fail
    const fallbackInterval = setInterval(() => {
      console.log('⏰ Polling fallback check...');
      checkState();
    }, 30000);

    return () => {
      console.log('🧹 Cleaning up focus/visibility effects');
      document.removeEventListener('visibilitychange', handleVisibilityChange, { capture: true });
      window.removeEventListener('focus', handleFocus, { capture: true });
      clearInterval(fallbackInterval);
    };
  }, [isEnabled]);

  // 5. Exit Prevention & Sync on Stay
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const syncState = useSyncStore.getState();
      const fsState = useFileSystemStore.getState();

      const hasDirty = fsState.notebooks.some(n => n.dirty) ||
        Object.values(fsState.folders).some((f: any) => f.dirty) ||
        Object.values(fsState.pages).some((p: any) => p.dirty);

      if (syncState.isEnabled && syncState.isConfigured && hasDirty) {
        // Standard way to trigger the "Leave site?" browser dialog
        e.preventDefault();
        e.returnValue = '';

        // If this code continues to run, it means the user might have clicked "Stay" 
        // (or the dialog is just showing). We schedule a sync for "if they stay".
        setTimeout(() => {
          // If we are still here after a short delay, the user likely chose to stay
          toast.info('Syncing pending changes...', { icon: '🔄' });
          sync(true); // Forced manual sync
        }, 500);

        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEnabled, sync]);

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <SessionExpiredDialog />
      <ConflictModal />
      <div id="ui-portal-root" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 1500 }}></div>
      <Layout />
    </>
  );
}

export default App;
