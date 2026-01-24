import { useEffect, useRef } from 'react';
import { Editor, DefaultColorStyle, DefaultSizeStyle, DefaultFontStyle, DefaultTextAlignStyle, DefaultDashStyle, DefaultFillStyle, GeoShapeGeoStyle } from 'tldraw';
import { opfs } from '../lib/opfs';
import { syncLog } from '../lib/debugLog';

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

    const loadPage = async () => {
      isLoadingRef.current = true; // Prevent saves during load

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
          editor.setStyleForNextShapes(DefaultColorStyle, userPrefs.textColor);
          editor.setStyleForNextShapes(DefaultSizeStyle, userPrefs.textSize);
          editor.setStyleForNextShapes(DefaultFontStyle, userPrefs.textFont);
          editor.setStyleForNextShapes(DefaultTextAlignStyle, userPrefs.textAlign === 'justify' ? 'start' : userPrefs.textAlign as any);
          editor.setStyleForNextShapes(DefaultDashStyle, userPrefs.dashStyle as any);
          editor.setStyleForNextShapes(DefaultFillStyle, userPrefs.fillStyle as any);
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
    // Reload if: 1. It's a version change AND (modifier is different OR modifier is unknown)
    const isRemoteChange = !isNewPage && pageVersion !== lastLoadRef.current.version && (!lastModifier || lastModifier !== clientId);

    if (isNewPage || isRemoteChange) {
      loadPage();
      lastLoadRef.current = { pageId, version: pageVersion };
    }

  }, [editor, pageId, pageVersion, lastModifier, clientId, userPrefs, sidebarColumns, leftHandedMode, isLoadingRef]);
};
