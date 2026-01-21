
import { useMemo, useState, useEffect } from 'react';
import { useFileSystemStore } from '../../store/fileSystemStore';
import type { Notebook, Folder, Page } from '../../types';
import styles from './Sidebar.module.css';
import { FolderPlus, FilePlus, BookPlus, Folder as FolderIcon, File, Book, ChevronRight, Trash2, PanelLeftClose, PanelRightClose } from 'lucide-react';
import clsx from 'clsx';
import { RenameOverlayV2 } from './RenameOverlay';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CircularButton } from '../UI/CircularButton';
import { HybridName } from '../UI/HybridName';
import { resolveItemColor, getThemeColorHex } from '../../lib/colorUtils';
import { useThemeColorHex } from '../../hooks/useThemeColor';
import { getIsDarkMode } from '../../lib/themeUtils';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

interface SortableItemProps {
  item: Notebook | Folder | Page;
  isActive: boolean;
  onSelect: (item: Notebook | Folder | Page) => void;
  onDoubleClick: (e: React.MouseEvent | React.PointerEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onDelete?: (id: string) => void;
  styles: any;
  isRtl: boolean;
  folders: Record<string, Folder>;
  pages: Record<string, Page>;
  notebooks: Notebook[];
  isDarkMode: boolean; // Add this
  isDraggingDisabled?: boolean;
}

const SortableItem = ({ item, isActive, onSelect, onDoubleClick, onPointerDown, onDelete, styles, isRtl, folders, pages, notebooks, isDarkMode, isDraggingDisabled }: SortableItemProps) => {
  const [dropZone, setDropZone] = useState<'top' | 'bottom' | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ id: item.id, data: { item, dropZone }, disabled: isDraggingDisabled });

  // Determine the drop zone based on relative Y position
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isOver || isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;

    // Simple 2-zone detection for reordering: Top half vs Bottom half
    if (relativeY < 0.5) setDropZone('top');
    else setDropZone('bottom');
  };

  useEffect(() => {
    if (!isOver) setDropZone(null);
  }, [isOver]);

  // Resolve effective color with inheritance
  const itemColorName = useMemo(() => resolveItemColor(item.id, folders, pages, notebooks), [item.id, folders, pages, notebooks]);
  const itemColorHex = useThemeColorHex(itemColorName, isDarkMode);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 999 : 'auto',
  };

  const isNotebook = !('notebookId' in item);
  const isFolder = 'notebookId' in item && !('updatedAt' in item);
  const isPage = 'updatedAt' in item;

  // No longer allowing nesting by dropping ON an item (middle zone removed)
  const canReceiveDrop = false;

  let Icon = File;
  if (isNotebook) Icon = Book;
  if (isFolder) Icon = FolderIcon;
  if (isPage) Icon = File;

  const nameStrokes = item.nameStrokes;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        // Use HEX values directly
        '--item-accent-color': itemColorHex,
        '--item-icon-color': itemColorHex,
        backgroundColor: isActive ? itemColorHex : undefined,
        color: isActive ? '#fff' : undefined
      } as React.CSSProperties}
      {...attributes}
      {...listeners}
      className={clsx(
        styles.item,
        isActive && styles.itemActive,
        canReceiveDrop && styles.dropInside
      )}
      onPointerMove={handlePointerMove}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        listeners?.onPointerDown(e);
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(`.${styles.itemActions}`)) return;
        onSelect(item);
      }}
      onDoubleClick={onDoubleClick}
    >
      {isOver && dropZone === 'top' && !isDragging && !canReceiveDrop && (
        <div className={clsx(styles.dropIndicator, styles.dropIndicatorTop)} />
      )}
      {isOver && dropZone === 'bottom' && !isDragging && !canReceiveDrop && (
        <div className={clsx(styles.dropIndicator, styles.dropIndicatorBottom)} />
      )}
      <Icon
        className={styles.icon}
        style={{ color: !isActive ? itemColorHex : undefined }}
      />
      <HybridName
        className={styles.nameContainer}
        name={item.name}
        strokes={nameStrokes}
        isRtl={isRtl}
      />
      <div className={styles.itemActions}>
        {onDelete && (
          <button
            type="button"
            className={styles.deleteBtn}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete(item.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
        {(isNotebook || isFolder) && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
      </div>
    </div>
  );
};


interface ColumnProps {
  id: string; // Column ID (mostly parentId)
  title: string;
  items: (Notebook | Folder | Page)[];
  activeId: string | null;
  onSelect: (item: Notebook | Folder | Page) => void;
  onAddFolder?: () => void;
  onAddPage?: () => void;
  onAddNotebook?: () => void;
  onRename: (id: string, name: string, strokes?: string, color?: string) => void;
  onRenameStart: (item: any, rect: DOMRect, pointerType: string) => void;
  onDelete?: (id: string) => void;
  type: 'notebook' | 'content';
  folders: Record<string, Folder>;
  pages: Record<string, Page>;
  notebooks: Notebook[];
  isDarkMode: boolean;
  isDraggingDisabled?: boolean;
}


const Column = ({ id, title, items, activeId, onSelect, onAddFolder, onAddPage, onAddNotebook, onRenameStart, onDelete, type, folders, pages, notebooks, isDarkMode, isDraggingDisabled }: ColumnProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [pointerType, setPointerType] = useState<string>('mouse');

  // Use Droppable for the column itself (for dropping into empty space)
  const { setNodeRef, isOver } = useDroppable({
    id: `container-${id}`,
    data: { type: 'container', containerId: id }
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(styles.column, isOver && styles.columnOver)}
      style={{ backgroundColor: isOver ? 'var(--color-surface-hover)' : undefined }}
    >
      {title && <div className={styles.header}>{title}</div>}

      <div className={styles.list}>
        <SortableContext
          id={id}
          items={items.map(i => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <div key={item.id} style={{ position: 'relative' }}>
              <SortableItem
                item={item}
                isActive={item.id === activeId}
                onSelect={onSelect}
                onPointerDown={(e) => setPointerType(e.pointerType)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onRenameStart(item, rect, pointerType);
                }}
                onDelete={onDelete}
                styles={styles}
                isRtl={isRtl}
                folders={folders}
                pages={pages}
                notebooks={notebooks}
                isDarkMode={isDarkMode}
                isDraggingDisabled={isDraggingDisabled}
              />
            </div>
          ))}
        </SortableContext>
      </div>



      <div className={styles.toolbar}>
        {type === 'notebook' && (
          <button className={styles.toolbarButton} onClick={onAddNotebook} title={t('new_notebook')}>
            <BookPlus size={16} />
            <span>{t('new_notebook')}</span>
          </button>
        )}
        {type === 'content' && (
          <>
            {onAddFolder && (
              <button className={styles.toolbarButton} onClick={onAddFolder} title={t('new_folder')}>
                <FolderPlus size={16} />
                <span>{t('new_folder')}</span>
              </button>
            )}
            {onAddPage && (
              <button className={styles.toolbarButton} onClick={onAddPage} title={t('new_page')}>
                <FilePlus size={16} />
                <span>{t('new_page')}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Local helper to check for descendant relationship
const checkIsDescendant = (childFolderId: string, potentialAncestorId: string, folders: Record<string, Folder>): boolean => {
  let current = folders[childFolderId];
  while (current && current.parentId) {
    if (current.parentId === potentialAncestorId) return true;
    current = folders[current.parentId];
  }
  return false;
};

export const Sidebar = () => {
  const { t } = useTranslation();
  const theme = useFileSystemStore(state => state.theme);
  const isDarkMode = getIsDarkMode(theme);

  const [editingItem, setEditingItem] = useState<{ item: any, rect: DOMRect, pointerType: string } | null>(null);

  const {
    notebooks, folders, pages, activePath, activeNotebookId, activePageId,
    createNotebook, createFolder, createPage,
    deleteNotebook, deleteFolder, deletePage,
    setActiveNotebook, selectPage, isSidebarOpen, toggleSidebar, renameNode,
    reorderNotebooks, moveNode, dominantHand, navigatePath
  } = useFileSystemStore();

  // Update global accent color based on active item
  useEffect(() => {
    // To simplify: resolve color based on the most specific active entity.
    // If activePageId is set, use it.
    // If not, use the last item in activePath (folder).
    // If activePath is empty (just notebook selected), use activeNotebookId.

    let targetId = activePageId;
    if (!targetId) {
      // Check active path for latest folder
      if (activePath.length > 0) {
        targetId = activePath[activePath.length - 1]; // Last folder
      } else {
        targetId = activeNotebookId; // Notebook
      }
    }


    const colorName = targetId ? resolveItemColor(targetId, folders, pages, notebooks) : 'grey';
    const colorHex = getThemeColorHex(colorName, isDarkMode);

    // Update CSS variable with HEX
    document.documentElement.style.setProperty('--color-accent', colorHex);
    // Set a unique app-specific accent variable that Tldraw won't shadow
    document.documentElement.style.setProperty('--app-accent-color', colorHex);
    // Also update selection background potentially?
    // .itemActive uses hsl(var(--color-selection-bg)).
    // Ideally we want the global accent to trigger everything.

  }, [activePageId, activeNotebookId, activePath, folders, pages, notebooks, isDarkMode]);

  const leftHandedMode = dominantHand === 'left';

  const [activeDragItem, setActiveDragItem] = useState<Notebook | Folder | Page | null>(null);

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    nameStrokes?: string;
    type: 'notebook' | 'folder' | 'page';
    itemCount: number;
    onConfirm: () => void;
  } | null>(null);


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const isDraggingDisabled = !!editingItem;

  // If editing, we should probably disable all dnd-kit sensors to prevent stealing events


  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item;
    setActiveDragItem(item);

    // If dragging a folder, close its children columns if open
    if (item && !(item as any).notebookId === false && !(item as any).updatedAt) {
      const folderId = item.id as string;
      const index = activePath.indexOf(folderId);
      if (index !== -1) {
        navigatePath(activePath.slice(0, index));
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    if (active.id !== over.id) {
      const activeData = active.data.current;
      const overData = over.data.current;
      const activeItem = activeData?.item;
      const overItem = overData?.item;

      const isActiveNotebook = activeItem && !(activeItem as any).notebookId;
      const isOverNotebook = overItem && !(overItem as any).notebookId;
      const isOverContainer = (over.id as string).startsWith('container-');

      // --- CASE 1: Notebook Movements ---
      if (isActiveNotebook) {
        // Notebooks can ONLY reorder. They can't be put inside anything.
        if (isOverNotebook || over.id === 'container-root-notebooks') {
          if (over.id === 'container-root-notebooks') {
            const lastNotebook = notebooks[notebooks.length - 1];
            if (lastNotebook && active.id !== lastNotebook.id) {
              reorderNotebooks(active.id as string, lastNotebook.id);
            }
          } else {
            reorderNotebooks(active.id as string, over.id as string);
          }
        }
        return;
      }

      // --- CASE 2: Content Movements (Pages/Folders) ---

      // Step A: Determine Target Parent and Insertion Mode
      let targetParentId: string | null = null;
      let isContainerDrop = false;

      if (isOverContainer) {
        // Dropped on a column header/empty space
        const containerId = (over.id as string).replace('container-', '');
        if (containerId === 'root-notebooks') return; // Should not happen for content
        targetParentId = containerId;
        isContainerDrop = true;
      } else if (isOverNotebook) {
        // Dropped on a notebook in the first column
        targetParentId = over.id as string;
        isContainerDrop = true;
      } else if (overItem) {
        // Dropped on another Folder or Page -> ALWAYS Reorder (no more middle-zone nesting)
        targetParentId = (overItem as any).parentId || (overItem as any).notebookId;
        isContainerDrop = false;
      }

      if (targetParentId) {
        // Security: Prevent circular moves
        if (active.id === targetParentId || checkIsDescendant(targetParentId, active.id as string, folders)) {
          return;
        }

        // Move or Reorder
        if (isContainerDrop) {
          moveNode(active.id as string, targetParentId, true);
        } else {
          moveNode(active.id as string, over.id as string, false);
        }
      }
    }
  };


  const columns = useMemo(() => {

    const cols = [];

    // --- Column 0 : Notebooks ---
    // Always show notebooks column unless... actually notebooks are root.
    cols.push({
      id: 'root-notebooks',
      title: '',
      items: notebooks,
      activeId: activeNotebookId || null,
      onSelect: (item: any) => {
        setActiveNotebook(item.id);
      },
      onAddNotebook: () => createNotebook(t('untitled_notebook')),
      onDelete: (id: string) => {
        const notebook = notebooks.find(n => n.id === id);
        if (!notebook) return;

        // Count all affected items in this notebook
        const affectedFolders = Object.values(folders).filter(f => f.notebookId === id).length;
        const affectedPages = Object.values(pages).filter(p => p.notebookId === id).length;
        const totalItems = affectedFolders + affectedPages;

        setPendingDelete({
          id,
          name: notebook.name,
          nameStrokes: notebook.nameStrokes,
          type: 'notebook',
          itemCount: totalItems,
          onConfirm: () => {
            deleteNotebook(id);
            setPendingDelete(null);
          }
        });
      },

      type: 'notebook' as const

    });


    // Determine current path [NB_ID, FOLDER1_ID, FOLDER2_ID, ...]
    const currentPath = activeNotebookId ? [activeNotebookId, ...activePath] : [];

    for (let i = 0; i < currentPath.length; i++) {
      const parentId = currentPath[i];
      const currentNotebookId = currentPath[0];

      // CONSTRAINT: If we are dragging a folder, we should NOT render columns that are
      // children of that folder (recursive hiding).
      // Also should we hide the column OF the folder itself if it's the one active?
      // No, usually you want to see where you are validly.

      // If we are dragging 'activeDragItem' and it is a FOLDER.
      // And 'parentId' is the ID of that folder... then we stop rendering subsequent columns?
      // Or if 'parentId' is equal to activeDragItem.id, we don't render its children column.

      if (activeDragItem && (activeDragItem as Folder).id === parentId) {
        // This parentId IS the folder being dragged. Do not render its children column.
        break;
      }

      // Also if 'parentId' is a descendant of the dragged folder (if deeply nested open)
      if (activeDragItem && checkIsDescendant(parentId, activeDragItem.id, folders)) {
        break;
      }


      const relevantFolders = Object.values(folders).filter(f => f.parentId === parentId);
      const relevantPages = Object.values(pages).filter(p => p.parentId === parentId);
      const children = [...relevantFolders, ...relevantPages].sort((a, b) => (a.order || 0) - (b.order || 0));

      // Determine the active item in THIS column
      // We look at the next item in the folder path OR if checking against activePageId
      const nextIdInPath = currentPath[i + 1];

      // A page is active here if its parent matches parentId AND it matches activePageId
      const isPageSelectedHere = activePageId && pages[activePageId]?.parentId === parentId;

      const activeIdInCol = nextIdInPath || (isPageSelectedHere ? activePageId : null);

      cols.push({
        id: parentId, // This is the CONTAINER ID (the parent folder or notebook)
        title: "",
        items: children,
        activeId: activeIdInCol || null,
        onSelect: (item: any) => {
          const isFolder = !item.updatedAt;
          if (isFolder) {
            const newFolderIds = [...currentPath.slice(1, i + 1), item.id];
            useFileSystemStore.getState().navigatePath(newFolderIds);
          } else {
            selectPage(item.id);
            // selectPage handles persistence internally now
          }
        },
        onAddFolder: () => createFolder(t('untitled_folder'), parentId, currentNotebookId),
        onAddPage: () => createPage(t('untitled_page'), parentId, currentNotebookId),
        onDelete: (id: string) => {
          const isFolder = !!folders[id];

          if (isFolder) {
            const folder = folders[id];

            // Count all descendants recursively
            const countDescendants = (folderId: string): number => {
              let count = 0;
              // Count pages in this folder
              Object.values(pages).forEach(p => {
                if (p.parentId === folderId) count++;
              });
              // Count subfolders and their descendants
              Object.values(folders).forEach(f => {
                if (f.parentId === folderId) {
                  count++; // Count the subfolder itself
                  count += countDescendants(f.id); // Count its descendants
                }
              });
              return count;
            };

            const totalItems = countDescendants(id);
            setPendingDelete({
              id,
              name: folder.name,
              nameStrokes: (folder as any).nameStrokes,
              type: 'folder',
              itemCount: totalItems,
              onConfirm: () => {
                deleteFolder(id);
                setPendingDelete(null);
              }
            });

          } else {
            const page = pages[id];
            if (!page) return;

            setPendingDelete({
              id,
              name: page.name,
              nameStrokes: (page as any).nameStrokes,
              type: 'page',
              itemCount: 0,
              onConfirm: () => {
                deletePage(id);
                setPendingDelete(null);
              }
            });

          }
        },

        type: 'content' as const

      });

    }

    return cols;
  }, [notebooks, folders, pages, activePath, activeNotebookId, activePageId, setActiveNotebook, createFolder, createPage, selectPage, createNotebook, activeDragItem, t, deleteFolder, deleteNotebook, deletePage, setPendingDelete]);

  if (!isSidebarOpen) return null;

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  return (
    <DndContext
      sensors={editingItem ? [] : sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={styles.sidebar}
        style={{
          '--sidebar-columns': columns.length,
          '--sidebar-left': leftHandedMode ? 'auto' : '0.75rem',
          '--sidebar-right': leftHandedMode ? '0.75rem' : 'auto',
        } as React.CSSProperties}
      >
        {columns.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            items={col.items}
            activeId={col.activeId}
            onSelect={col.onSelect}
            // ... pass down store maps
            folders={folders}
            pages={pages}
            notebooks={notebooks}
            isDarkMode={isDarkMode}
            onAddFolder={col.onAddFolder}
            onAddPage={col.onAddPage}
            onAddNotebook={col.onAddNotebook}
            onRenameStart={(item, rect, pointerType) => {
              console.log(`[Sidebar] onRenameStart id=${item.id} type=${pointerType}`);
              setEditingItem({ item, rect, pointerType });
            }}
            onRename={renameNode}
            onDelete={col.onDelete}
            type={col.type}
            isDraggingDisabled={isDraggingDisabled}
          />
        ))}
      </div>

      {editingItem && (
        <RenameOverlayV2
          key={editingItem.item.id}
          initialName={editingItem.item.name}
          initialStrokes={editingItem.item.nameStrokes}
          initialColor={editingItem.item.color}
          initialPointerType={editingItem.pointerType}
          onSave={(name, strokes, color) => {
            renameNode(editingItem.item.id, name, strokes, color);
            setEditingItem(null);
          }}
          onCancel={() => setEditingItem(null)}
          anchorRect={editingItem.rect}
        />
      )}

      <CircularButton
        onClick={toggleSidebar}
        title={t('sidebar_close')}
        icon={leftHandedMode ? <PanelRightClose size={18} /> : <PanelLeftClose size={18} />}
        className={styles.closeButton}
        style={{
          '--sidebar-columns': columns.length,
          '--close-left': leftHandedMode ? 'auto' : `calc(250px * ${columns.length} + 0.75rem + 12px)`,
          '--close-right': leftHandedMode ? `calc(250px * ${columns.length} + 0.75rem + 12px)` : 'auto',
        } as React.CSSProperties}
      />

      <DragOverlay dropAnimation={dropAnimation}>
        {activeDragItem ? (() => {
          // Logic copied from SortableItem to render the preview
          const isNotebook = !(activeDragItem as any).notebookId;
          const isFolder = !isNotebook && !(activeDragItem as Page).updatedAt;
          const isPage = !isNotebook && !isFolder;

          let Icon = File;
          if (isNotebook) Icon = Book;
          if (isFolder) Icon = FolderIcon;
          if (isPage) Icon = File;

          const nameStrokes = (activeDragItem as any).nameStrokes;

          return (
            <div
              className={clsx(styles.item)}
              style={{
                background: 'hsl(var(--color-bg-secondary))',
                color: 'hsl(var(--color-text-primary))',
                border: '1px solid hsl(var(--color-text-secondary) / 0.2)',
                borderRadius: '6px',
                opacity: 1,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <Icon className={styles.icon} />
              <HybridName
                name={activeDragItem.name}
                strokes={nameStrokes}
                className={styles.nameContainer}
              />
              <div className={styles.itemActions}>
                {(isNotebook || isFolder) && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
              </div>
            </div>
          );
        })() : null}
      </DragOverlay>

      <DeleteConfirmModal
        isOpen={!!pendingDelete}
        itemName={pendingDelete?.name || ''}
        itemStrokes={pendingDelete?.nameStrokes}
        itemType={pendingDelete?.type || 'page'}
        itemCount={pendingDelete?.itemCount}
        onConfirm={() => {
          pendingDelete?.onConfirm();
        }}

        onCancel={() => setPendingDelete(null)}
      />

    </DndContext >
  );
};


