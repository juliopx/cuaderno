import { useEffect, useRef } from 'react';
import { Editor } from 'tldraw';
import { opfs } from '../lib/opfs';
import { syncLog } from '../lib/debugLog';
import { useFileSystemStore } from '../store/fileSystemStore';

export const usePagePersistence = (
  editor: Editor,
  pageId: string,
  sidebarColumns: number,
  leftHandedMode: boolean,
  isLoadingRef: React.MutableRefObject<boolean>
) => {
  const hasUnsavedChangesRef = useRef(false);
  const lastCameraRef = useRef({ x: 0, y: 0, z: 1 });

  useEffect(() => {
    if (!pageId) return;

    const save = async () => {
      // No guardar mientras se está cargando para evitar pisotear datos
      if (isLoadingRef.current) {
        syncLog(`[CENTERING] 🚫 Guardado cancelado: Cargando página.`);
        return;
      }

      if (!hasUnsavedChangesRef.current) {
        return;
      }

      const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
      const viewportCenter = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : (window.innerWidth + sidebarWidth) / 2;
      const viewportHalfHeight = window.innerHeight / 2;

      const fullSnapshot = editor.getSnapshot();

      // Obtener todos los registros directamente del store (método más fiable en v4)
      const allRecordsArray = editor.store.allRecords();

      // Filtramos records transitorios
      const filteredRecords = allRecordsArray.filter(r =>
        r.typeName !== 'instance' &&
        r.typeName !== 'pointer' &&
        r.typeName !== 'camera'
      );

      // Convertimos el array de nuevo a un objeto Record<ID, Record>
      const filteredStore = Object.fromEntries(filteredRecords.map(r => [r.id, r]));

      const { x, y, z } = editor.getCamera();
      // Normalización de cámara
      const normalizedX = x - (viewportCenter / z);
      const normalizedY = y - (viewportHalfHeight / z);

      // Creamos el snapshot con la estructura que tldraw espera
      const filteredSnapshot = {
        store: filteredStore,
        schema: (fullSnapshot as any).schema || (editor.store as any).schema?.serialize() || {},
        camera: { x: normalizedX, y: normalizedY, z }
      };

      try {
        const serialized = JSON.stringify(filteredSnapshot);
        await opfs.saveFile(`page-${pageId}.tldr`, serialized);

        // Señalizar cambio para sincronización
        useFileSystemStore.getState().markPageDirty(pageId);

        syncLog(`🔶 [CENTERING] Disco guardado: ${filteredRecords.length} reg. Pos: {x: ${normalizedX.toFixed(0)}, y: ${normalizedY.toFixed(0)}}`);
      } catch (err) {
        console.error(`[CENTERING] ❌ ERROR AL ESCRIBIR EN DISCO:`, err);
      }

      hasUnsavedChangesRef.current = false;
    };

    // Register this save function to be called before sync
    useFileSystemStore.getState().registerActivePageSaver(save);

    let timeout: any;
    const handleSave = () => {
      hasUnsavedChangesRef.current = true;
      clearTimeout(timeout);
      timeout = setTimeout(save, 500);
    };

    const cleanup = editor.store.listen((event) => {
      // Ignore events during page load
      if (isLoadingRef.current) return;

      const { added, updated, removed } = event.changes;

      // Check if any relevant records (shapes or camera) were modified
      const hasRelevantChanges = Object.keys(added).length > 0 ||
        Object.keys(removed).length > 0 ||
        Object.values(updated).some(([, to]: any) => {
          const type = to.typeName;

          if (type === 'shape' && event.source === 'user') {
            return true;
          }

          if (type === 'camera') {
            const cam = to;
            const moved = cam.x !== lastCameraRef.current.x || cam.y !== lastCameraRef.current.y || cam.z !== lastCameraRef.current.z;
            if (moved) {
              lastCameraRef.current = { x: cam.x, y: cam.y, z: cam.z };
              return true;
            }
          }

          return false;
        });

      if (hasRelevantChanges) {
        handleSave();
      }
    });

    return () => {
      cleanup();
      // If we have unsaved changes when the component or pageId changes, trigger one last save
      if (hasUnsavedChangesRef.current) {
        save();
      }
      clearTimeout(timeout);
    };
  }, [editor, pageId, sidebarColumns, leftHandedMode, isLoadingRef]);
};
