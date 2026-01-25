import { useEffect, useRef } from 'react';
import { Editor, GeoShapeGeoStyle } from 'tldraw';
import { opfs } from '../lib/opfs';
import { syncLog } from '../lib/debugLog';
import { useFileSystemStore } from '../store/fileSystemStore';

export const usePageLoading = (
  editor: Editor,
  pageId: string,
  pageVersion: number,
  lastModifier: string | undefined,
  clientId: string,
  userPrefs: any,
  sidebarColumns: number,
  leftHandedMode: boolean,
  isLoadingRef: React.MutableRefObject<boolean>
) => {
  const lastLoadRef = useRef<{ pageId: string | null; version: number | null }>({ pageId: null, version: null });

  useEffect(() => {
    if (!pageId) return;

    const loadPage = async (reason: string) => {
      isLoadingRef.current = true; // Prevent saves during load
      syncLog(`📥 [usePageLoading] Starting loadPage for ${pageId} (v${pageVersion}). Reason: ${reason}`);

      const json = await opfs.loadFile(`page-${pageId}.tldr`);
      if (json && json !== '{}' && json !== '') {
        try {
          const snapshot = JSON.parse(json);
          editor.loadSnapshot(snapshot);

          // Denormalize camera: Restore position relative to the center of the NEW viewport
          if (snapshot.camera) {
            const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
            const viewportCenter = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : (window.innerWidth + sidebarWidth) / 2;
            const viewportHalfHeight = window.innerHeight / 2;

            // visualX = diskX + (center / zoom)
            const actualX = snapshot.camera.x + (viewportCenter / snapshot.camera.z);
            const actualY = snapshot.camera.y + (viewportHalfHeight / snapshot.camera.z);

            syncLog(`📥 [CENTERING] Restoring: DiskX ${snapshot.camera.x.toFixed(0)} -> VisualX ${actualX.toFixed(0)}`);
            editor.setCamera({ x: actualX, y: actualY, z: snapshot.camera.z });
          } else {
            // Document exists but no camera? Default to centered origin
            const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
            const viewportHalfWidth = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : (window.innerWidth + sidebarWidth) / 2;
            const viewportHalfHeight = window.innerHeight / 2;
            const centerX = viewportHalfWidth;
            const centerY = viewportHalfHeight;
            editor.setCamera({ x: centerX, y: centerY, z: 1 });
          }

          // 💡 PRIMING with User Preferences
          // 💡 PRIMING with User Preferences
          // We defer specific style setting to the Bubble component or Tool initialization
          // which knows the active tool. Setting generic defaults here (like textColor)
          // overrides the correct tool settings (like drawColor) if initialized blindly.
          editor.setStyleForNextShapes(GeoShapeGeoStyle, userPrefs.lastUsedGeo as any);
        } catch (e) {
          console.error("Failed to load snapshot", e);
        }
      } else {
        // New or Empty page: EXPLICITLY clear shapes to prevent bleed
        const shapeIds = editor.getCurrentPageShapeIds();
        if (shapeIds.size > 0) {
          editor.deleteShapes(Array.from(shapeIds));
        }

        // Center on origin (0,0) taking sidebar into account
        const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
        const viewportHalfWidth = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : (window.innerWidth + sidebarWidth) / 2;
        const viewportHalfHeight = window.innerHeight / 2;
        const centerX = viewportHalfWidth;
        const centerY = viewportHalfHeight;
        editor.setCamera({ x: centerX, y: centerY, z: 1 });
      }

      // Delay to ensure all load-related events have settled
      // 500ms provides a safer buffer against false-positive auto-saves
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 500);
    };

    const isNewPage = pageId !== lastLoadRef.current.pageId;

    // Multi-tab check: Did OUR session author this version change?
    const selfPushedVersion = useFileSystemStore.getState().lastSelfPushedVersions[pageId] || 0;
    const isOurChange = pageVersion === selfPushedVersion;

    // Reload if: 1. It's a version change AND 2. We didn't author it recently
    const isRemoteChange = !isNewPage && pageVersion !== lastLoadRef.current.version && !isOurChange;

    if (isNewPage || isRemoteChange) {
      if (isRemoteChange) {
        syncLog(`📥 [usePageLoading] Remote change detected: v${lastLoadRef.current.version} -> v${pageVersion} (Author: ${lastModifier === clientId ? 'Shared Client/Other Tab' : 'External'})`);
      }
      loadPage(isNewPage ? 'New Page' : 'Remote Change');
      lastLoadRef.current = { pageId, version: pageVersion };
    } else {
      if (pageVersion !== lastLoadRef.current.version) {
        syncLog(`📥 [usePageLoading] Skip reload: v${lastLoadRef.current.version} -> v${pageVersion} (Reason: Already in Editor)`);
        lastLoadRef.current.version = pageVersion;
      }
    }

  }, [editor, pageId, pageVersion, lastModifier, clientId, userPrefs, sidebarColumns, leftHandedMode, isLoadingRef]);
};
