import {
  Tldraw,
  useEditor,
  createShapeId,
  track,
  DefaultColorStyle,
  DefaultSizeStyle,
  DefaultFontStyle,
  DefaultTextAlignStyle,
  transact
} from 'tldraw'
import 'tldraw/tldraw.css'
import styles from './CanvasArea.module.css';
import { Toolbar } from '../Toolbar/Toolbar';
import { Bubble } from '../Bubble/Bubble';
import { useState, useEffect, useRef } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useFileSystemStore } from '../../store/fileSystemStore';
import { useSyncStore } from '../../store/syncStore';
import { useTextStyleStore } from '../../store/textStyleStore';
import { opfs } from '../../lib/opfs';
import { RichTextShapeUtil } from '../../shapes/RichTextShapeUtil';
import { syncLog } from '../../lib/debugLog';

const customShapeUtils = [RichTextShapeUtil];


interface CanvasInterfaceProps {
  pageId: string;
  isDark: boolean;
}


// Main Component Logic (Reactive)
const CanvasInterface = track(({ pageId, pageVersion, lastModifier, clientId, isDark, parentRef }: CanvasInterfaceProps & { pageVersion: number, lastModifier?: string, clientId: string, parentRef: React.RefObject<HTMLDivElement | null> }) => {
  const editor = useEditor();
  // State to prevent flickering when switching focus between text shapes
  const forceTextModeRef = useRef(false);
  const [isLockingUI, setIsLockingUI] = useState(false);
  const manualToolRef = useRef<string>('select');

  const { isSidebarOpen, toggleSidebar } = useFileSystemStore();
  const textStyles = useTextStyleStore();

  const lastLoadRef = useRef<{ pageId: string | null; version: number | null }>({ pageId: null, version: null });
  const isLoadingRef = useRef(false);

  // Load Snapshot
  useEffect(() => {
    if (!pageId) return;

    const loadPage = async () => {
      isLoadingRef.current = true; // Prevent saves during load

      const json = await opfs.loadFile(`page-${pageId}.tldr`);
      if (json) {
        try {
          const snapshot = JSON.parse(json);
          editor.loadSnapshot(snapshot);

          // 💡 RESET defaults (User requested M by default, overrides snapshot persistence)
          editor.setStyleForNextShapes(DefaultColorStyle, 'black');
          textStyles.updateStyles({ color: 'black' });
          editor.setStyleForNextShapes(DefaultSizeStyle, 'm');
          textStyles.updateStyles({ size: 'm' });
          editor.setStyleForNextShapes(DefaultFontStyle, 'sans');
          textStyles.updateStyles({ font: 'sans' });
          editor.setStyleForNextShapes(DefaultTextAlignStyle, 'start');
          textStyles.updateStyles({ align: 'start' });
        } catch (e) {
          console.error("Failed to load snapshot", e);
        }
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

    console.log(`[Canvas] Reload Check:
      PageId: ${pageId} (Last: ${lastLoadRef.current.pageId})
      Version: ${pageVersion} (Last: ${lastLoadRef.current.version})
      Modifier: ${lastModifier?.slice(0, 8)} (Client: ${clientId?.slice(0, 8)})
      -> isNew: ${isNewPage}, isRmChg: ${isRemoteChange}
    `);

    if (isNewPage || isRemoteChange) {
      console.log('[Canvas] ♻️ Triggering Reload...');
      loadPage();
      lastLoadRef.current = { pageId, version: pageVersion };
    }

  }, [editor, pageId, pageVersion, lastModifier, clientId]);

  // Save Snapshot Listener
  const hasUnsavedChangesRef = useRef(false);

  // Save Snapshot Listener
  useEffect(() => {
    if (!pageId) return;

    const save = async () => {
      // If triggered by sync (forced), ONLY save if we actually have unsaved changes.
      // This prevents "dirtying" a clean page just because sync was clicked.
      if (!hasUnsavedChangesRef.current) {
        return;
      }

      const snapshot = editor.getSnapshot();
      await opfs.saveFile(`page-${pageId}.tldr`, JSON.stringify(snapshot));

      // Update page version in store so sync picks it up
      useFileSystemStore.getState().markPageDirty(pageId);

      // Log that page was marked dirty
      syncLog(`🔶 [Canvas] Saved page ${pageId} - dirty`);

      // Reset changes flag
      hasUnsavedChangesRef.current = false;
    };

    // Register this save function to be called before sync
    useFileSystemStore.getState().registerActivePageSaver(save);

    let timeout: any;
    const handleSave = () => {
      hasUnsavedChangesRef.current = true; // Mark that we have pending changes
      clearTimeout(timeout);
      // Reduce debounce to 200ms to minimize risk of syncing stale content
      timeout = setTimeout(save, 200);
    };

    const cleanup = editor.store.listen((event) => {
      // Ignore events during page load
      if (isLoadingRef.current) return;

      // Only trigger auto-save if there are actual content changes from user
      if (event.source === 'user') {
        const { added, updated, removed } = event.changes;

        // Check if any shapes were actually modified (not just selection/camera changes)
        const hasShapeChanges = Object.keys(added).length > 0 ||
          Object.keys(removed).length > 0 ||
          Object.values(updated).some(([_, to]: any) => {
            // Ignore changes to instance state (selection, camera, etc)
            return to.typeName === 'shape';
          });

        if (hasShapeChanges) {
          handleSave();
        }
      }

      const { updated } = event.changes;
      Object.values(updated).forEach(([, to]: any) => {
        if (to.type === 'text' || to.type === 'rich-text') {
          // Log prop changes to trace alignment/style issues
          // console.log(`[${new Date().toISOString()}] [EditorUpdate] Text updated:`, to.id, to.props);
        }
      });
    });
    return () => {
      cleanup();
      clearTimeout(timeout);
    };
  }, [editor, pageId]);

  // Derived Active Tool State (Reactive via track)
  const currentToolId = editor.getCurrentToolId();
  const editingShapeId = editor.getEditingShapeId();
  const editingShape = editingShapeId ? editor.getShape(editingShapeId) : null;
  const isEmulatedTextTool = editingShape && (editingShape.type === 'text' || editingShape.type === 'rich-text');

  const activeTool = (() => {
    // 1. Force override (Creation/Switching/Intent)
    if (forceTextModeRef.current || isLockingUI) return 'text';

    // 2. Real Text Editing
    if (isEmulatedTextTool) return 'text';

    // 3. User intentional Sticky Tool
    if (manualToolRef.current === 'text' && currentToolId === 'select') return 'text';

    // 4. Fallback to real tool
    return currentToolId;
  })();

  // Sync isLockingUI back to Ref for non-reactive handlers
  useEffect(() => {
    forceTextModeRef.current = isLockingUI;

    // Manage CSS class reactively
    if (parentRef.current) {
      if (isLockingUI) {
        parentRef.current.classList.add(styles.hideSelection);
      } else {
        parentRef.current.classList.remove(styles.hideSelection);
      }
    }
  }, [isLockingUI, parentRef]);

  // STICKY TOOL: If user intent is 'text', push back from 'select' if idle
  useEffect(() => {
    if (manualToolRef.current === 'text' && currentToolId === 'select' && !editingShapeId && !isLockingUI) {
      editor.setCurrentTool('text');
    }
  }, [currentToolId, editingShapeId, isLockingUI, editor]);

  // AUTO-UNLOCK: When editing starts, we can safely reveal the UI
  useEffect(() => {
    if (isEmulatedTextTool && isLockingUI) {
      setIsLockingUI(false);
    }
  }, [isEmulatedTextTool, isLockingUI, editingShapeId]);


  const handleSelectTool = (tool: string) => {
    manualToolRef.current = tool;
    editor.setEditingShape(null); // Exit edit mode first
    editor.setCurrentTool(tool);
  };


  // Force Tldraw internal theme
  useEffect(() => {
    editor.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });
  }, [editor, isDark]);

  // --- Interaction Engine ---
  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    // 1. Pointer Down (Text Logic)
    const handlePointerDownCapture = (e: PointerEvent) => {
      // Ignore clicks on UI elements (Toolbar, Bubble, etc.)
      const target = e.target as HTMLElement;
      if (target.closest('[data-is-ui="true"]')) return;

      const toolId = editor.getCurrentToolId();
      if (toolId !== 'text') return;

      const p = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const shape = editor.getShapeAtPoint(p);

      // A. Click on Existing Text -> Focus Edit
      if (shape && (shape.type === 'text' || shape.type === 'rich-text')) {

        if (editor.getEditingShapeId() === shape.id) {
          return;
        }

        // Switching from select or another edit

        // LOCK UI: Prevent flicker to 'select' mode
        setIsLockingUI(true);

        // Batch operations to prevent intermediate render of "Selection Box"
        transact(() => {
          // Explicitly set tool back to 'text' to ensure it's "sticky"
          editor.setEditingShape(shape.id);
        });

        e.stopPropagation();
        return;
      }

      // B. Click on Empty -> Create (Wait for Drag decision)
      if (!shape) {
        e.stopPropagation();

        const id = createShapeId();
        const startX = p.x;
        const startY = p.y;

        // Initial: Auto Size (Click default)
        const currentStyles = useTextStyleStore.getState();

        editor.createShape({
          id,
          type: 'rich-text',
          x: startX,
          y: startY,
          props: {
            html: '',
            autoSize: true, // Auto by default
            w: 200, h: 50,
            isCreating: true, // Show dashed border
            // Inject saved configuration
            color: currentStyles.color,
            size: currentStyles.size,
            font: currentStyles.font,
            align: currentStyles.align,
            bold: currentStyles.bold,
            italic: currentStyles.italic,
            underline: currentStyles.underline,
            strike: currentStyles.strike
          }
        });

        editor.select(id);

        if (parentRef.current) parentRef.current.classList.add(styles.hideSelection);

        const onPointerMove = (moveEvent: PointerEvent) => {
          const curr = editor.screenToPage({ x: moveEvent.clientX, y: moveEvent.clientY });
          const dist = Math.hypot(curr.x - startX, curr.y - startY);

          if (dist > 5) {
            // Dragging -> Switch to Fixed Mode
            const w = Math.max(50, curr.x - startX);
            const h = Math.max(30, curr.y - startY);
            editor.updateShape({ id, type: 'rich-text', props: { w, h, autoSize: false } });
          }
        };

        const onPointerUp = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);

          // LOCK UI for transition
          setIsLockingUI(true);
          if (parentRef.current) parentRef.current.classList.add(styles.hideSelection);

          transact(() => {
            editor.updateShape({ id, type: 'rich-text', props: { isCreating: false } });
            editor.setCurrentTool('text'); // Stay in text mode
            editor.select(id);
            editor.setEditingShape(id);
          });

          // The useEffect will handle the unlock once editing starts
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      }
    };

    // 2. Double Click (Select -> Text Edit)
    const handleDoubleClick = (e: MouseEvent) => {
      const p = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const shape = editor.getShapeAtPoint(p);
      if (shape && (shape.type === 'rich-text' || shape.type === 'text')) {
        console.log(`[${new Date().toISOString()}] [Click] DoubleClick on:`, shape.id);
        // If we double click a text, we enter edit mode. 
        // We stay in the current tool or jump to select as Tldraw normally does,
        // but our activeTool logic will handle the UI if manualToolRef is 'text'.
        editor.setEditingShape(shape.id);
      }
    };

    container.addEventListener('pointerdown', handlePointerDownCapture, { capture: true });
    container.addEventListener('dblclick', handleDoubleClick);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDownCapture, { capture: true });
      container.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [editor]);

  // 3. Pro Interaction: Entering Text tool while a text shape is selected -> Start Editing
  useEffect(() => {
    const handleToolChange = () => {
      if (editor.getCurrentToolId() === 'text') {
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length === 1) {
          const shape = editor.getShape(selectedIds[0]);
          if (shape && (shape.type === 'text' || shape.type === 'rich-text')) {
            // Already selected -> Enter edit mode immediately
            if (editor.getEditingShapeId() !== shape.id) {
              editor.setEditingShape(shape.id);
            }
          }
        }
      }
    };

    // We can use the store listen or a simple effect on currentToolId
    const toolId = editor.getCurrentToolId();
    if (toolId === 'text') {
      handleToolChange();
    }
  }, [editor.getCurrentToolId()]);


  // Interaction state
  let isPanning = false;
  let isZooming = false;
  let lastPoint = { x: 0, y: 0 };
  // We'll store the previous tool to restore it after Space panning
  let previousTool = 'select';

  // --- Event Handlers ---
  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent native context menu to allow right-click panning
      e.preventDefault();
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Right-click (button 2) OR Middle-click (button 1) -> Start Panning
      if (e.button === 2 || e.button === 1) {
        isPanning = true;
        lastPoint = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      // Control + Left-click (button 0) -> Start Zooming
      if (e.button === 0 && e.ctrlKey) {
        isZooming = true;
        lastPoint = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - lastPoint.x;
        const deltaY = e.clientY - lastPoint.y;
        lastPoint = { x: e.clientX, y: e.clientY };

        // Pan the camera
        const { x, y, z } = editor.getCamera();
        editor.setCamera({ x: x + deltaX / z, y: y + deltaY / z, z });
        return;
      }

      if (isZooming) {
        const deltaY = e.clientY - lastPoint.y;
        lastPoint = { x: e.clientX, y: e.clientY };

        // Drag Up -> Zoom In
        const zoomRate = 0.01;
        const { z } = editor.getCamera();
        const factor = 1 - deltaY * zoomRate;
        const newZoom = Math.max(0.1, Math.min(5, z * factor));

        // Center zoom on pointer
        const p = editor.screenToPage({ x: e.clientX, y: e.clientY });

        // Calculate local coordinates
        const rect = container.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;

        // Manual zoom calculation
        const newX = (localX / newZoom) - p.x;
        const newY = (localY / newZoom) - p.y;

        editor.setCamera({ x: newX, y: newY, z: newZoom });
        return;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isPanning || isZooming) {
        isPanning = false;
        isZooming = false;
        try { container.releasePointerCapture(e.pointerId); } catch (err) { }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // "Rueda de ratón" (Mouse Wheel) -> Zoom
      if (e.ctrlKey) return;

      e.preventDefault();
      e.stopPropagation();

      const { clientX, clientY, deltaY } = e;
      const { z } = editor.getCamera();

      // Zoom factor
      const zoomDetails = 0.001;
      const factor = 1 - deltaY * zoomDetails;
      const safeFactor = Math.max(0.1, Math.min(8, z * factor));

      const p = editor.screenToPage({ x: clientX, y: clientY });

      // Calculate local coordinates relative to the container for correct camera math
      const rect = container.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      const newX = (localX / safeFactor) - p.x;
      const newY = (localY / safeFactor) - p.y;

      editor.setCamera({ x: newX, y: newY, z: safeFactor });
    };

    // Space Key Logic for Panning
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering while typing
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      const isEditingText = activeEl && 'isContentEditable' in activeEl && (activeEl as HTMLElement).isContentEditable;
      if (isInput || isEditingText) return;

      // 1. Delete / Backspace -> Delete selected shapes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const isEditingShape = !!editor.getEditingShapeId();
        if (isEditingShape || isInput || isEditingText) return;

        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          console.log('[CanvasArea] Deleting selected:', selectedIds);
          editor.deleteShapes(selectedIds);
          e.preventDefault();
        }
        return;
      }

      // 2. Space -> Hand Tool (Panning)
      if (
        e.code === 'Space' &&
        !e.repeat &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        editor.getCurrentToolId() !== 'hand'
      ) {
        previousTool = editor.getCurrentToolId();
        editor.setCurrentTool('hand');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && editor.getCurrentToolId() === 'hand') {
        editor.setCurrentTool(previousTool);
      }
    };

    // Attach listeners
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    // Use capture to preempt Tldraw's default scroll handling
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel, { capture: true } as any);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editor]);


  return (
    <div className={styles.canvasContainer}>
      <div className={styles.topBar}>
        <button className={styles.iconButton} onClick={toggleSidebar}>
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
      </div>

      <Toolbar activeTool={activeTool} onSelectTool={handleSelectTool} />
      <Bubble activeTool={activeTool} />
    </div>
  );
});

export const CanvasArea = () => {
  const { activePageId, isSidebarOpen, toggleSidebar, theme, pages } = useFileSystemStore();
  const parentRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const currentVersion = activePageId ? (pages[activePageId]?.version || 0) : 0;
  const lastModifier = activePageId ? pages[activePageId]?.lastModifier : undefined;
  const clientId = useSyncStore.getState().clientId;

  // Show empty state when no page is selected
  if (!activePageId) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.topBar}>
          <button className={styles.iconButton} onClick={toggleSidebar}>
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'hsl(var(--color-text-secondary))',
          fontSize: '1.125rem'
        }}>
          Select a page to start drawing
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} ref={parentRef}>
      <Tldraw
        persistenceKey={`cuaderno-${activePageId}`}
        hideUi
        inferDarkMode={isDark}
        shapeUtils={customShapeUtils}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE}
      >
        <CanvasInterface
          pageId={activePageId}
          pageVersion={currentVersion}
          lastModifier={lastModifier}
          clientId={clientId}
          isDark={isDark}
          parentRef={parentRef}
        />
      </Tldraw>
    </div>
  );
};
