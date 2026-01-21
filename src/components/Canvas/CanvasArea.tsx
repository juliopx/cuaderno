import {
  Tldraw,
  useEditor,
  createShapeId,
  track,
  DefaultColorStyle,
  DefaultSizeStyle,
  DefaultFontStyle,
  DefaultTextAlignStyle,
  transact,
  DefaultContextMenu
} from 'tldraw'
import 'tldraw/tldraw.css'
import styles from './CanvasArea.module.css';
import { Toolbar } from '../Toolbar/Toolbar';
import { Bubble } from '../Bubble/Bubble';
import { KeyboardEvent, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getIsDarkMode } from '../../lib/themeUtils';
import {
  LocateFixed,
  PanelLeftOpen,
  PanelRightOpen,
  Undo2,
  Redo2
} from 'lucide-react';
import { CircularButton } from '../UI/CircularButton';
import { useFileSystemStore } from '../../store/fileSystemStore';
import { useSyncStore } from '../../store/syncStore'; // Assuming this is the correct path, user provided 'useSyncStore'
import { useTextStyleStore } from '../../store/textStyleStore';
import { opfs } from '../../lib/opfs';
import { RichTextShapeUtil } from '../../shapes/RichTextShapeUtil';
import { syncLog } from '../../lib/debugLog';
import { CanvasTitle } from './CanvasTitle';
import { UIPortal } from '../UIPortal';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx'; // Added clsx for HistoryControls

const customShapeUtils = [RichTextShapeUtil];

const CenterMark = track(() => {
  const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';
  if (!isDebug) return null;

  const editor = useEditor();
  const screenPoint = editor.pageToScreen({ x: 0, y: 0 });

  return (
    <div
      style={{
        position: 'absolute',
        left: screenPoint.x,
        top: screenPoint.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 999,
        opacity: 0.8,
        color: '#ff0000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    </div>
  );
});

const DebugOverlay = track(({ sidebarColumns }: { sidebarColumns: number }) => {
  const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';
  if (!isDebug) return null;

  const editor = useEditor();
  const { x, y, z } = editor.getCamera();
  const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const columnWidth = 250;
  const margin = 12;
  const sidebarWidth = sidebarColumns > 0 ? (columnWidth * sidebarColumns + margin * 2) : 0;
  const viewportCenter = (screen.w + sidebarWidth) / 2;

  // Normalized X: 0 means perfectly centered in the available space
  const normalizedX = x - (viewportCenter / z);

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '4.5rem',
        zIndex: 1000,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        padding: '0.4rem 0.8rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--glass-border)',
        fontSize: '11px',
        color: 'hsl(var(--color-text-secondary))',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        boxShadow: 'var(--shadow-md)'
      }}
    >
      <div title="Actual Camera">CAM: {x.toFixed(0)}, {y.toFixed(0)}, {z.toFixed(2)}</div>
      <div title="Normalized (Universal) Camera" style={{ color: 'var(--color-accent)' }}>NORM: {normalizedX.toFixed(0)}</div>
      <div>WIN: {screen.w}x{screen.h}</div>
      <div>SIDE: {sidebarWidth}px</div>
    </div>
  );
});

const HistoryControls = track(({ sidebarColumns, leftHandedMode }: { sidebarColumns: number, leftHandedMode: boolean }) => {
  const editor = useEditor();
  const { t } = useTranslation();

  const canUndo = editor.getCanUndo();
  const canRedo = editor.getCanRedo();

  const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;

  return (
    <div
      className={styles.historyControls}
      style={{
        [leftHandedMode ? 'right' : 'left']: `calc(${sidebarWidth}px + 1rem)`,
        [leftHandedMode ? 'left' : 'right']: 'auto'
      } as React.CSSProperties}
    >
      <CircularButton
        onClick={() => editor.undo()}
        disabled={!canUndo}
        title={t('undo')}
        icon={<Undo2 size={20} />}
        className={clsx(styles.historyButton, !canUndo && styles.disabled)}
      />
      <CircularButton
        onClick={() => editor.redo()}
        disabled={!canRedo}
        title={t('redo')}
        icon={<Redo2 size={20} />}
        className={clsx(styles.historyButton, !canRedo && styles.disabled)}
      />
    </div>
  );
});

interface CanvasInterfaceProps {
  pageId: string;
  isDark: boolean;
}


// Main Component Logic (Reactive)
const CanvasInterface = track(({ pageId, pageVersion, lastModifier, clientId, isDark, parentRef, sidebarColumns, leftHandedMode }: CanvasInterfaceProps & { pageVersion: number, lastModifier?: string, clientId: string, parentRef: React.RefObject<HTMLDivElement | null>, sidebarColumns: number, leftHandedMode: boolean }) => {
  const { t, i18n } = useTranslation();
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

          // 1. Override isShapeErasable to only allow erasing 'draw' (handwriting) shapes
          const originalIsErasable = (editor as any).isShapeErasable ? (editor as any).isShapeErasable.bind(editor) : null;

          // Try both new and old names just in case
          (editor as any).isErasable = (shape: any) => {
            if (editor.getCurrentToolId() === 'eraser') return shape.type === 'draw';
            return originalIsErasable ? originalIsErasable(shape) : true;
          };
          (editor as any).isShapeErasable = (editor as any).isErasable;

          // 💡 RESET defaults
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

  }, [editor, pageId, pageVersion, lastModifier, clientId]); // sidebarColumns intentionally omitted to prevent reloads on toggle

  // Save Snapshot Listener
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
      // Si fullSnapshot tiene 'store' y 'schema', seguimos ese patrón
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

      // LOG EVERYTHING for debugging
      // Object.values(updated).forEach(([, to]: any) => console.log(`[CENTERING] 📝 Record update: ${to.typeName}`));

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

          // Instance: We ignore this for auto-save as it triggers on every mouse move (cursor tracking)
          // The 'camera' record above is sufficient for panning and zoom persistence.
          return false;
        });

      if (hasRelevantChanges) {
        handleSave();
      }

      Object.values(updated).forEach(([, to]: any) => {
        if (to.type === 'text' || to.type === 'rich-text') {
          // Log prop changes to trace alignment/style issues
          // console.log(`[${new Date().toISOString()}] [EditorUpdate] Text updated:`, to.id, to.props);
        }
      });
    });

    return () => {
      cleanup();
      // If we have unsaved changes when the component or pageId changes, trigger one last save
      if (hasUnsavedChangesRef.current) {
        save();
      }
      clearTimeout(timeout);
    };
  }, [editor, pageId, sidebarColumns]);

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

  // --- Eraser Override Logic ---
  useEffect(() => {
    if (!editor) return;

    const originalIsErasable = (editor as any).isShapeErasable ? (editor as any).isShapeErasable.bind(editor) : null;

    // Try both new and old names just in case
    (editor as any).isErasable = (shape: any) => {
      if (editor.getCurrentToolId() === 'eraser') return shape.type === 'draw';
      return originalIsErasable ? originalIsErasable(shape) : true;
    };
    (editor as any).isShapeErasable = (editor as any).isErasable;

    return () => {
      // Restore
      if (editor) {
        if (originalIsErasable) {
          (editor as any).isErasable = originalIsErasable;
          (editor as any).isShapeErasable = originalIsErasable;
        } else {
          delete (editor as any).isErasable;
          delete (editor as any).isShapeErasable;
        }
      }
    };
  }, [editor]);

  // --- Pen Mode Logic ---
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    // Track active touches to support multi-touch panning
    const activeTouchIds = new Set<number>();
    let previousTool: string | null = null;
    let didSwitchToHand = false;

    const handlePointerDown = (e: PointerEvent) => {
      if (document.body.classList.contains('rename-overlay-active')) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target.closest?.('[data-is-ui="true"]')) return;

      console.log(`[CanvasArea] pointerdown type=${e.pointerType} src=${target.constructor.name}`);
      const { penMode } = useFileSystemStore.getState();
      const currentTool = editor.getCurrentToolId();

      // If Pen Mode is on, and we are drawing/erasing, and input is NOT pen
      if (penMode && (currentTool === 'draw' || currentTool === 'eraser') && e.pointerType !== 'pen') {
        // Switch to 'hand' tool for panning
        if (activeTouchIds.size === 0) {
          previousTool = currentTool;
          editor.setCurrentTool('hand');
          didSwitchToHand = true;
        }
        activeTouchIds.add(e.pointerId);
        // Do NOT stop propagation - let Tldraw handle it as a Hand tool event
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (document.body.classList.contains('rename-overlay-active')) return;

      const target = e.target as HTMLElement;
      if (target.closest?.('[data-is-ui="true"]')) return;
      console.log(`[CanvasArea] pointerup type=${e.pointerType} target=${target.tagName}#${target.id}.${target.className}`);
      if (activeTouchIds.has(e.pointerId)) {
        activeTouchIds.delete(e.pointerId);

        // If all fingers lifted and we previously switched tool, restore it
        if (activeTouchIds.size === 0 && didSwitchToHand) {
          const toolToRestore = previousTool;
          didSwitchToHand = false;
          previousTool = null;

          // Restore text/draw tool on next frame to safely exit hand mode
          requestAnimationFrame(() => {
            if (toolToRestore && editor) {
              // Only restore if we are still in hand mode (user didn't change tool manually)
              if (editor.getCurrentToolId() === 'hand') {
                editor.setCurrentTool(toolToRestore);
              }
            }
          });
        }
      }
    };

    // Use capture to intercept before Tldraw acts on it
    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    // Global up/cancel needed because drag can end outside canvas
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerUp, { capture: true });
    };
  }, [editor, parentRef]);





  // Force Tldraw internal theme
  useEffect(() => {
    editor.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });
  }, [editor, isDark]);

  // Sync Tldraw locale with app language
  useEffect(() => {
    editor.user.updateUserPreferences({ locale: i18n.language });
  }, [editor, i18n.language]);

  // --- Interaction Engine ---
  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    // 1. Pointer Down (Text Logic)
    const handlePointerDownCapture = (e: PointerEvent) => {
      // Ignore clicks on UI elements (Toolbar, Bubble, etc.)
      const target = e.target as HTMLElement;
      if (target.closest('[data-is-ui="true"]')) return;

      // Allow panning with middle/right click (ignore if not left click)
      if (e.button !== 0) return;

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
  const isPanningRef = useRef(false);
  const isZoomingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const startPanningPointRef = useRef({ x: 0, y: 0 });
  const startPanningCameraRef = useRef({ x: 0, y: 0, z: 1 });
  // We'll store the previous tool to restore it after Space panning
  const previousToolRef = useRef('select');

  // --- Event Handlers ---
  // --- Interaction Engine ---
  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    // Context menu is now handled by TLDraw's DefaultContextMenu component
    // No custom handler needed

    // Longpress detection for touch and pen
    const LONGPRESS_DURATION = 600; // ms
    const MOVEMENT_THRESHOLD = 10; // px
    let longpressTimer: number | null = null;
    let longpressStart: { x: number; y: number; target: EventTarget | null } | null = null;

    const handlePointerDownForLongpress = (e: PointerEvent) => {
      // Only for touch and pen in selection mode
      const currentTool = editor.getCurrentToolId();
      const isEditingText = !!editor.getEditingShapeId();

      if ((e.pointerType === 'touch' || e.pointerType === 'pen') &&
        currentTool === 'select' &&
        !isEditingText &&
        e.button === 0) {
        longpressStart = { x: e.clientX, y: e.clientY, target: e.target };

        longpressTimer = setTimeout(() => {
          if (longpressStart) {
            // Only use the blocker in PWA standalone mode
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
              (window.navigator as any).standalone ||
              document.referrer.includes('android-app://');

            if (isStandalone) {
              // Create a visual blocker div to intercept trailing events
              const blocker = document.createElement('div');
              blocker.style.position = 'fixed';
              blocker.style.inset = '0';
              blocker.style.zIndex = '100000';
              blocker.style.backgroundColor = 'transparent';
              blocker.style.pointerEvents = 'auto';
              blocker.style.touchAction = 'none';

              let isRemoving = false;
              const cleanup = () => {
                if (blocker.parentNode) {
                  document.body.removeChild(blocker);
                }
                window.removeEventListener('pointerdown', handleEvent, { capture: true });
                window.removeEventListener('pointerup', handleEvent, { capture: true });
                window.removeEventListener('touchend', handleEvent, { capture: true });
                window.removeEventListener('click', handleEvent, { capture: true });
                window.removeEventListener('contextmenu', handleEvent, { capture: true });
              };

              const handleEvent = (e: any) => {
                const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
                const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

                // If we are waiting to remove (finger already lifted) and user clicks somewhere else (likely the menu)
                if ((e.type === 'pointerdown' || e.type === 'touchstart') && isRemoving) {
                  const dist = Math.hypot(x - longpressStart!.x, y - longpressStart!.y);
                  if (dist > 40) {
                    cleanup();
                    return; // Let this interaction pass to Tldraw
                  }
                }

                // Otherwise, block everything
                e.preventDefault();
                e.stopImmediatePropagation();

                if (e.type === 'pointerup' || e.type === 'touchend' || e.type === 'click') {
                  if (!isRemoving) {
                    isRemoving = true;
                    // Safety cleanup if user never interacts again
                    setTimeout(cleanup, 250);
                  }
                }
              };

              // Capture phase on window to intercept BEFORE Tldraw 
              window.addEventListener('pointerdown', handleEvent, { capture: true });
              window.addEventListener('pointerup', handleEvent, { capture: true });
              window.addEventListener('touchend', handleEvent, { capture: true });
              window.addEventListener('click', handleEvent, { capture: true });
              window.addEventListener('contextmenu', handleEvent, { capture: true });

              document.body.appendChild(blocker);
            }

            // Trigger context menu at pointer position
            const contextMenuEvent = new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: longpressStart.x,
              clientY: longpressStart.y,
            });
            longpressStart.target?.dispatchEvent(contextMenuEvent);
            longpressStart = null;
          }
        }, LONGPRESS_DURATION);
      }
    };

    const handlePointerMoveForLongpress = (e: PointerEvent) => {
      if (longpressStart && longpressTimer) {
        const distance = Math.hypot(
          e.clientX - longpressStart.x,
          e.clientY - longpressStart.y
        );

        if (distance > MOVEMENT_THRESHOLD) {
          clearTimeout(longpressTimer);
          longpressTimer = null;
          longpressStart = null;
        }
      }
    };

    const handlePointerUpForLongpress = () => {
      if (longpressTimer) {
        clearTimeout(longpressTimer);
        longpressTimer = null;
        longpressStart = null;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Only middle mouse button for panning (button 1)
      // Right-click (button 2) is now reserved for context menu
      if (e.button === 1) {
        isPanningRef.current = true;
        startPanningPointRef.current = { x: e.clientX, y: e.clientY };
        startPanningCameraRef.current = editor.getCamera();
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      if (e.button === 0 && e.ctrlKey) {
        isZoomingRef.current = true;
        lastPointRef.current = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isPanningRef.current) {
        const deltaX = e.clientX - startPanningPointRef.current.x;
        const deltaY = e.clientY - startPanningPointRef.current.y;

        const { x, y, z } = startPanningCameraRef.current;
        // Panning 1:1 - add total delta divided by initial zoom to get follow-mouse behavior
        editor.setCamera({ x: x + deltaX / z, y: y + deltaY / z, z });
        return;
      }
      if (isZoomingRef.current) {
        const deltaY = e.clientY - lastPointRef.current.y;
        lastPointRef.current = { x: e.clientX, y: e.clientY };
        const zoomRate = 0.01;
        const { z } = editor.getCamera();
        const factor = 1 - deltaY * zoomRate;
        const newZoom = Math.max(0.1, Math.min(5, z * factor));
        const p = editor.screenToPage({ x: e.clientX, y: e.clientY });
        const rect = container.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const newX = (localX / newZoom) - p.x;
        const newY = (localY / newZoom) - p.y;
        editor.setCamera({ x: newX, y: newY, z: newZoom });
        return;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isPanningRef.current || isZoomingRef.current) {
        isPanningRef.current = false;
        isZoomingRef.current = false;
        try { container.releasePointerCapture(e.pointerId); } catch (err) { }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const { clientX, clientY, deltaY } = e;
      const { z } = editor.getCamera();
      const zoomDetails = 0.001;
      const factor = 1 - deltaY * zoomDetails;
      const safeFactor = Math.max(0.1, Math.min(8, z * factor));
      const p = editor.screenToPage({ x: clientX, y: clientY });
      const rect = container.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const newX = (localX / safeFactor) - p.x;
      const newY = (localY / safeFactor) - p.y;
      editor.setCamera({ x: newX, y: newY, z: safeFactor });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      const isEditingText = activeEl && 'isContentEditable' in activeEl && (activeEl as HTMLElement).isContentEditable;
      if (isInput || isEditingText) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const isEditingShape = !!editor.getEditingShapeId();
        if (isEditingShape || isInput || isEditingText) return;
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          editor.deleteShapes(selectedIds);
          e.preventDefault();
        }
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        e.preventDefault();
        return;
      }

      // Redo (Alternative)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        editor.redo();
        e.preventDefault();
        return;
      }

      if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.shiftKey && !e.altKey && editor.getCurrentToolId() !== 'hand') {
        previousToolRef.current = editor.getCurrentToolId();
        editor.setCurrentTool('hand');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && editor.getCurrentToolId() === 'hand') {
        editor.setCurrentTool(previousToolRef.current);
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Longpress event listeners for touch and pen
    container.addEventListener('pointerdown', handlePointerDownForLongpress);
    container.addEventListener('pointermove', handlePointerMoveForLongpress);
    container.addEventListener('pointerup', handlePointerUpForLongpress);
    container.addEventListener('pointercancel', handlePointerUpForLongpress);


    // --- Gesture Detection (2/3 Finger Tap) ---
    let touchStartTime = 0;
    let initialTouches: { id: number, x: number, y: number }[] = [];
    let touchMoving = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Ignore if it's already a complex gesture or we are in tool mode that might conflict
      if (e.touches.length === 2 || e.touches.length === 3) {
        touchStartTime = Date.now();
        touchMoving = false;
        initialTouches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
      } else {
        initialTouches = [];
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (initialTouches.length > 0) {
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          const initial = initialTouches.find(it => it.id === t.identifier);
          if (initial) {
            const dist = Math.hypot(t.clientX - initial.x, t.clientY - initial.y);
            if (dist > 10) { // Movement threshold
              touchMoving = true;
              break;
            }
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (initialTouches.length > 0 && e.touches.length === 0) {
        const duration = Date.now() - touchStartTime;
        if (duration < 300 && !touchMoving) {
          if (initialTouches.length === 2) {
            editor.undo();
          } else if (initialTouches.length === 3) {
            editor.redo();
          }
        }
        initialTouches = [];
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel, { capture: true } as any);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      // Cleanup longpress event listeners
      container.removeEventListener('pointerdown', handlePointerDownForLongpress);
      container.removeEventListener('pointermove', handlePointerMoveForLongpress);
      container.removeEventListener('pointerup', handlePointerUpForLongpress);
      container.removeEventListener('pointercancel', handlePointerUpForLongpress);

      // Clear any pending longpress timer
      if (longpressTimer) {
        clearTimeout(longpressTimer);
      }

      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [editor]);

  // --- Sidebar Panning Transition ---
  const lastSidebarColumnsRef = useRef(sidebarColumns);
  useEffect(() => {
    if (lastSidebarColumnsRef.current === sidebarColumns) return;

    const columnWidth = 250;
    const margin = 12;
    const prevWidth = lastSidebarColumnsRef.current > 0 ? (columnWidth * lastSidebarColumnsRef.current + margin * 2) : 0;
    const currWidth = sidebarColumns > 0 ? (columnWidth * sidebarColumns + margin * 2) : 0;
    const diff = currWidth - prevWidth;

    const { x, y, z } = editor.getCamera();
    // Shift camera by half the diff / zoom to keep content centered in the remaining visible space
    // If sidebar on RIGHT expands, shift camera to the LEFT (invert diff)
    const shiftX = leftHandedMode ? -diff : diff;
    editor.setCamera({ x: x + (shiftX / 2) / z, y, z }, { animation: { duration: 300 } });

    lastSidebarColumnsRef.current = sidebarColumns;
  }, [editor, sidebarColumns]);

  const handleSelectTool = (tool: string) => {
    manualToolRef.current = tool;

    // Deselect all when switching to drawing tools
    if (tool === 'draw' || tool === 'eraser') {
      editor.selectNone();
    }

    editor.setEditingShape(null); // Exit edit mode first
    editor.setCurrentTool(tool);

    if (tool === 'text') {
      // Re-apply styles...
      editor.setStyleForNextShapes(DefaultColorStyle, textStyles.color);
      editor.setStyleForNextShapes(DefaultSizeStyle, textStyles.size);
      editor.setStyleForNextShapes(DefaultFontStyle, textStyles.font);
      const validAlign = textStyles.align === 'justify' ? 'start' : textStyles.align;
      editor.setStyleForNextShapes(DefaultTextAlignStyle, validAlign);
    }
  };

  return (
    <div className={styles.canvasContainer}>
      <DebugOverlay sidebarColumns={sidebarColumns} />
      <CenterMark />
      {!isSidebarOpen && (
        <UIPortal>
          <div
            className={styles.topBar}
            style={{
              '--topbar-left': leftHandedMode ? 'auto' : '1rem',
              '--topbar-right': leftHandedMode ? '1rem' : 'auto',
            } as React.CSSProperties}
          >
            <button className={styles.iconButton} onClick={toggleSidebar}>
              {leftHandedMode ? <PanelRightOpen size={20} /> : <PanelLeftOpen size={20} />}
            </button>
          </div>
          <CanvasTitle />
        </UIPortal>
      )}

      <Toolbar activeTool={activeTool} onSelectTool={handleSelectTool} />
      <Bubble activeTool={activeTool} />

      <HistoryControls sidebarColumns={sidebarColumns} leftHandedMode={leftHandedMode} />

      <CircularButton
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          // Simple debounce to prevent single click action on double click? 
          // For now, let's allow both or assume user intent. 
          // Actually, Tldraw might be grabbing focus.
          if (editor) {
            const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
            const viewportCenter = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : (window.innerWidth + sidebarWidth) / 2;
            const viewportHalfHeight = window.innerHeight / 2;
            const { z } = editor.getCamera();
            editor.setCamera({ x: viewportCenter / z, y: viewportHalfHeight / z, z }, { animation: { duration: 300 } });
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const bounds = editor.getCurrentPageBounds();
          if (!bounds) return;

          const sidebarWidth = sidebarColumns > 0 ? (250 * sidebarColumns + 24) : 0;
          const padding = 64;
          const availableWidth = window.innerWidth - sidebarWidth - padding;
          const availableHeight = window.innerHeight - padding;

          if (availableWidth <= 0 || availableHeight <= 0) return;

          // Calculate ideal zoom (clamped to max 1 for clarity)
          const zoomX = availableWidth / bounds.w;
          const zoomY = availableHeight / bounds.h;
          const z = Math.min(zoomX, zoomY, 1);

          // Target screen center (offset by sidebar)
          const targetX = leftHandedMode ? (window.innerWidth - sidebarWidth) / 2 : sidebarWidth + (window.innerWidth - sidebarWidth) / 2;
          const targetY = window.innerHeight / 2;

          // camera.x = target_screen_x / zoom - target_page_x
          const camX = (targetX / z) - (bounds.x + bounds.w / 2);
          const camY = (targetY / z) - (bounds.y + bounds.h / 2);

          editor.setCamera({ x: camX, y: camY, z }, { animation: { duration: 300 } });
        }}
        title={t('recenter')}
        icon={<LocateFixed size={20} />}
        className={styles.recenterButton}
        style={{
          '--recenter-right': leftHandedMode ? 'auto' : '1rem',
          '--recenter-left': leftHandedMode ? '1rem' : 'auto',
        } as React.CSSProperties}
      />
    </div>
  );
});

export const CanvasArea = () => {
  const { t } = useTranslation();
  const { activePageId, isSidebarOpen, toggleSidebar, theme, pages, activePath, activeNotebookId, dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';
  const parentRef = useRef<HTMLDivElement>(null);

  const isDark = getIsDarkMode(theme);

  const currentVersion = activePageId ? (pages[activePageId]?.version || 0) : 0;
  const lastModifier = activePageId ? pages[activePageId]?.lastModifier : undefined;
  const clientId = useSyncStore.getState().clientId;

  // Show empty state when no page is selected
  if (!activePageId) {
    const sidebarColumns = isSidebarOpen ? (activeNotebookId ? activePath.length + 2 : 1) : 0;
    const sidebarWidth = sidebarColumns > 0 ? (sidebarColumns * 250 + 24) : 0;

    return (
      <div className={styles.wrapper} style={{ '--sidebar-columns': sidebarColumns } as React.CSSProperties}>
        {!isSidebarOpen && (
          <UIPortal>
            <div
              className={styles.topBar}
              style={{
                '--topbar-left': leftHandedMode ? 'auto' : '1rem',
                '--topbar-right': leftHandedMode ? '1rem' : 'auto',
              } as React.CSSProperties}
            >
              <button className={styles.iconButton} onClick={toggleSidebar}>
                {leftHandedMode ? <PanelRightOpen size={20} /> : <PanelLeftOpen size={20} />}
              </button>
            </div>
            <CanvasTitle />
          </UIPortal>
        )}
        <div
          className={styles.welcomeScreen}
          data-dominant-hand={dominantHand}
          style={{
            [leftHandedMode ? 'paddingRight' : 'paddingLeft']: `${sidebarWidth}px`,
          }}>
          <div className={styles.welcomeContent}>
            <div className={styles.welcomeBranding}>
              <h1>Cuaderno</h1>
            </div>
            <div className={styles.welcomeDescription}>
              <p>
                {t('welcome_description')}
              </p>
            </div>
            <nav className={styles.welcomeNav}>
              <a href="/cuaderno/privacy.html">{t('privacy_policy')}</a>
              <a href="/cuaderno/terms.html">{t('terms_of_service')}</a>
            </nav>
            <div className={styles.welcomeInstruction}>
              {t('select_page_to_start')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sidebarColumns = isSidebarOpen ? (activeNotebookId ? activePath.length + 2 : 1) : 0;

  return (
    <div className={styles.wrapper} ref={parentRef} style={{ '--sidebar-columns': sidebarColumns } as React.CSSProperties}>
      <Tldraw
        hideUi
        inferDarkMode={isDark}
        shapeUtils={customShapeUtils}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE}
        options={{ maxPages: 1 }}
        components={{
          ContextMenu: DefaultContextMenu,
        }}
        overrides={{
          actions(_editor, actions) {
            // Remove the "move-to-page" action if it still exists
            delete actions['move-to-page'];
            delete actions['context-menu.move-to-page'];
            return actions;
          },
        }}
      >
        <CanvasInterface
          pageId={activePageId}
          pageVersion={currentVersion}
          lastModifier={lastModifier}
          clientId={clientId}
          isDark={isDark}
          parentRef={parentRef}
          sidebarColumns={sidebarColumns}
          leftHandedMode={leftHandedMode}
        />
      </Tldraw>
    </div>
  );
};
