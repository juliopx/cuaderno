import {
  Tldraw,
  useEditor,
  track,
  DefaultContextMenu
} from 'tldraw'
import 'tldraw/tldraw.css'
import styles from './CanvasArea.module.css';
import { Bubble } from '../Bubble/Bubble';
import { useEffect, useRef, useState } from 'react';
import { getIsDarkMode } from '../../lib/themeUtils';
import { LocateFixed, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { CircularButton } from '../UI/CircularButton';
import { useFileSystemStore } from '../../store/fileSystemStore';
import { useSyncStore } from '../../store/syncStore';
import { useUserPreferencesStore } from '../../store/userPreferencesStore';
import { RichTextShapeUtil } from '../../shapes/RichTextShapeUtil';
import { CustomGeoShapeUtil } from '../../shapes/CustomGeoShapeUtil';
import { CustomDrawShapeUtil } from '../../shapes/CustomDrawShapeUtil';
import { CustomLineShapeUtil } from '../../shapes/CustomLineShapeUtil';
import { CustomArrowShapeUtil } from '../../shapes/CustomArrowShapeUtil';
import { useTranslation } from 'react-i18next';

// Extracted Components
import { CenterMark } from './CenterMark';
import { DebugOverlay } from './DebugOverlay';
import { HistoryControls } from './HistoryControls';
import { WelcomeScreen } from './WelcomeScreen';
import { CanvasTitle } from './CanvasTitle';

// Extracted Hooks
import { usePageLoading } from '../../hooks/usePageLoading';
import { usePagePersistence } from '../../hooks/usePagePersistence';
import { useEraserOverride } from '../../hooks/useEraserOverride';
import { useTouchPanning } from '../../hooks/useTouchPanning';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';
import { useLongPressBlocker } from '../../hooks/useLongPressBlocker';
import { useStyleMemory } from '../../hooks/useStyleMemory';
import { useSidebarPanning } from '../../hooks/useSidebarPanning';
import { useRecenter } from '../../hooks/useRecenter';

const customShapeUtils = [
  RichTextShapeUtil,
  CustomGeoShapeUtil,
  CustomDrawShapeUtil,
  CustomLineShapeUtil,
  CustomArrowShapeUtil
];

interface CanvasInterfaceProps {
  pageId: string;
  isDark: boolean;
}

const CanvasInterface = track(({ pageId, pageVersion, lastModifier, clientId, parentRef, sidebarColumns, leftHandedMode, isDark }: CanvasInterfaceProps & { pageVersion: number, lastModifier?: string, clientId: string, parentRef: React.RefObject<HTMLDivElement | null>, sidebarColumns: number, leftHandedMode: boolean }) => {
  const { t } = useTranslation();
  const editor = useEditor();
  const forceTextModeRef = useRef(false);
  const [isLockingUI, setIsLockingUI] = useState(false);
  const [manualTool, setManualTool] = useState<string>('select');


  const userPrefs = useUserPreferencesStore();
  const isLoadingRef = useRef(false);

  // Explicitly sync theme with editor
  useEffect(() => {
    editor.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });
  }, [editor, isDark]);

  // Use Extracted Hooks
  const { lastGeoToolRef } = useStyleMemory(editor);

  usePageLoading(editor, pageId, pageVersion, lastModifier, clientId, userPrefs, sidebarColumns, leftHandedMode, isLoadingRef);
  usePagePersistence(editor, pageId, sidebarColumns, leftHandedMode, isLoadingRef);
  useEraserOverride(editor);
  useTouchPanning(editor);
  useCanvasInteractions(editor, parentRef, manualTool, setIsLockingUI, userPrefs, lastGeoToolRef);
  useLongPressBlocker(editor);
  useSidebarPanning(editor, sidebarColumns, leftHandedMode);

  const { handleRecenter, handleRecenterAll } = useRecenter(editor, sidebarColumns, leftHandedMode);

  // Derived Active Tool State
  const editingShapeId = editor.getEditingShapeId();
  const editingShape = editingShapeId ? editor.getShape(editingShapeId) : null;
  const isEmulatedTextTool = editingShape && (editingShape.type === 'text' || editingShape.type === 'rich-text');
  const currentToolId = editor.getCurrentToolId();

  const activeTool = (() => {
    if (forceTextModeRef.current || isLockingUI) return 'text';
    if (isEmulatedTextTool) return 'text';
    if (manualTool === 'text' && currentToolId === 'select') return 'text';
    if (manualTool === 'shapes' && currentToolId === 'select') return 'shapes';
    if (['geo', 'arrow', 'line'].includes(currentToolId)) return 'shapes';
    return currentToolId;
  })();

  useEffect(() => {
    forceTextModeRef.current = isLockingUI;
    if (parentRef.current) {
      parentRef.current.classList.toggle(styles.hideSelection, isLockingUI);
    }
  }, [isLockingUI, parentRef]);

  // Handle auto-unlock
  useEffect(() => {
    if (isEmulatedTextTool && isLockingUI) setIsLockingUI(false);
  }, [isEmulatedTextTool, isLockingUI]);

  const handleSelectTool = (tool: string) => {
    setManualTool(tool);
    if (['draw', 'eraser'].includes(tool)) editor.selectNone();
    editor.setEditingShape(null);

    if (tool === 'shapes') {
      editor.setCurrentTool(lastGeoToolRef.current as any);
    } else if (tool.startsWith('geo-')) {
      editor.setCurrentTool(tool);
    } else {
      editor.setCurrentTool(tool);
    }
  };

  return (
    <div className={styles.canvasContainer}>
      <DebugOverlay sidebarColumns={sidebarColumns} />
      <CenterMark />
      <Bubble
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        onUpload={(files) => {
          const center = editor.getViewportPageBounds().center;
          editor.putExternalContent({ type: 'files', files, point: center });
        }}
        onAddUrl={(url) => {
          const center = editor.getViewportPageBounds().center;
          editor.putExternalContent({ type: 'url', url, point: center });
        }}
      />
      <HistoryControls sidebarColumns={sidebarColumns} leftHandedMode={leftHandedMode} />
      <CircularButton
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); handleRecenter(); }}
        onDoubleClick={(e) => { e.stopPropagation(); handleRecenterAll(); }}
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
  const { activePageId, isSidebarOpen, toggleSidebar, theme, pages, activePath, activeNotebookId, dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';
  const parentRef = useRef<HTMLDivElement>(null);
  const isDark = getIsDarkMode(theme);
  const currentVersion = activePageId ? (pages[activePageId]?.version || 0) : 0;

  if (!activePageId) {
    return (
      <WelcomeScreen
        isSidebarOpen={isSidebarOpen}
        activeNotebookId={activeNotebookId}
        activePath={activePath}
        dominantHand={dominantHand}
        toggleSidebar={toggleSidebar}
      />
    );
  }

  const sidebarColumns = isSidebarOpen ? (activeNotebookId ? activePath.length + 2 : 1) : 0;
  const lastModifier = activePageId ? pages[activePageId]?.lastModifier : undefined;
  const clientId = useSyncStore.getState().clientId;

  return (
    <div className={styles.wrapper} ref={parentRef} style={{ '--sidebar-columns': sidebarColumns } as React.CSSProperties}>
      <style>{`
        /* Reposition tldraw watermark to avoid overlapping with recenter button */
        .tl-watermark_SEE-LICENSE,
        [data-testid="tl-watermark-licensed"] { 
          right: 80px !important;
        }
      `}</style>
      {!isSidebarOpen && (
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
      )}
      <CanvasTitle />
      <Tldraw
        hideUi
        inferDarkMode={isDark}
        shapeUtils={customShapeUtils}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE}
        options={{ maxPages: 1 }}
        components={{ ContextMenu: DefaultContextMenu }}
        overrides={{
          actions(_editor, actions) {
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
