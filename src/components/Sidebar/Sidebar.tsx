
import { useMemo, useState, useEffect } from 'react';
import { useFileSystemStore } from '../../store/fileSystemStore';
import type { Notebook, Folder, Page } from '../../types';
import styles from './Sidebar.module.css';
import { FolderPlus, FilePlus, BookPlus, Folder as FolderIcon, File, Book, ChevronRight, Trash2, PanelLeftClose, PanelRightClose } from 'lucide-react';
import clsx from 'clsx';
import { RenameOverlayV2 } from './RenameOverlay';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CircularButton } from '../UI/CircularButton';
import { getSvgPathBoundingBox } from '../../lib/svgUtils';
import { resolveItemColor, getThemeColorHex } from '../../lib/colorUtils';
import { useThemeColorHex } from '../../hooks/useThemeColor';
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
  activeDragItem: Notebook | Folder | Page | null;
  isRtl: boolean;
  folders: Record<string, Folder>;
  pages: Record<string, Page>;
  notebooks: Notebook[];
  isDarkMode: boolean; // Add this
}

const SortableItem = ({ item, isActive, onSelect, onDoubleClick, onPointerDown, onDelete, styles, activeDragItem, isRtl, folders, pages, notebooks, isDarkMode }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ id: item.id, data: { item } });

  // Resolve effective color with inheritance
  const itemColorName = useMemo(() => resolveItemColor(item.id, folders, pages, notebooks), [item.id, folders, pages, notebooks, (item as any).color, (item as any).parentId]);
  const itemColorHex = useThemeColorHex(itemColorName, isDarkMode);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 999 : 'auto',
  };

  const isNotebook = !(item as any).notebookId;
  const isFolder = !isNotebook && !(item as Page).updatedAt;
  const isPage = !isNotebook && !isFolder;

  // Determine if this item should highlight as a drop target
  const canReceiveDrop = useMemo(() => {
    if (!isOver || !activeDragItem || isDragging) return false;

    // Check if the dragged item is a notebook (notebooks can't be moved into folders)
    const isDraggingNotebook = !(activeDragItem as any).notebookId;
    if (isDraggingNotebook) return false;

    // Notebooks can always receive drops (they are never siblings with content)
    if (isNotebook) return true;

    // Folders can receive drops if the active item is NOT a sibling
    if (isFolder) {
      const activeParentId = (activeDragItem as any).parentId;
      const overParentId = (item as any).parentId;
      return activeParentId !== overParentId;
    }

    return false;
  }, [isOver, activeDragItem, isDragging, isNotebook, isFolder, item]);

  let Icon = File;
  if (isNotebook) Icon = Book;
  if (isFolder) Icon = FolderIcon;
  if (isPage) Icon = File;

  const nameStrokes = (item as any).nameStrokes;
  let svgWidth = 250;
  let viewBox = "0 0 250 40";
  let drawingWidth = 0;
  let bbox: any = null;

  if (nameStrokes) {
    bbox = getSvgPathBoundingBox(nameStrokes);
    if (bbox && !bbox.isEmpty) {
      drawingWidth = bbox.x + bbox.width;
      const w = Math.max(250, drawingWidth);
      svgWidth = w;
      viewBox = `0 0 ${w} 40`;
    }
  }

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
      className={clsx(styles.item, isActive && styles.itemActive, canReceiveDrop && styles.itemOver)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(`.${styles.itemActions}`)) return;
        onSelect(item);
      }}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
    >
      <Icon
        className={styles.icon}
        style={{ color: !isActive ? itemColorHex : undefined }}
      />
      <div className={styles.nameContainer}>
        <span className={styles.nameText}>{item.name}</span>
        {nameStrokes && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              insetInlineStart: '8px',
              width: `${svgWidth}px`,
              minWidth: `${svgWidth}px`,
              maxWidth: 'none',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            <svg
              viewBox={viewBox}
              width={svgWidth}
              height={32}
              style={{ display: 'block' }}
            >
              <path
                d={nameStrokes}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                transform={isRtl ? `translate(${svgWidth - (bbox?.x + bbox?.width || 0)}, 0)` : undefined}
              />
            </svg>
          </div>
        )}
      </div>
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
  onDelete?: (id: string) => void;
  type: 'notebook' | 'content';
  activeDragItem: Notebook | Folder | Page | null;
  folders: Record<string, Folder>;
  pages: Record<string, Page>;
  notebooks: Notebook[];
  isDarkMode: boolean;
}


const Column = ({ id, title, items, activeId, onSelect, onAddFolder, onAddPage, onAddNotebook, onRename, onDelete, type, activeDragItem, folders, pages, notebooks, isDarkMode }: ColumnProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
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
                  setAnchorRect(rect);
                  setEditingId(item.id);
                }}
                onDelete={onDelete}
                styles={styles}
                activeDragItem={activeDragItem}
                isRtl={isRtl}
                folders={folders}
                pages={pages}
                notebooks={notebooks}
                isDarkMode={isDarkMode}
              />

              {editingId === item.id && anchorRect && (
                <RenameOverlayV2
                  initialName={item.name}
                  initialStrokes={(item as any).nameStrokes}
                  initialColor={(item as any).color}
                  initialPointerType={pointerType}
                  onSave={(name, strokes, color) => {
                    onRename(item.id, name, strokes, color);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                  anchorRect={anchorRect}
                />
              )}
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

export const Sidebar = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (document.documentElement.getAttribute('data-theme') === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const {
    notebooks, folders, pages, activePath, activeNotebookId, activePageId,
    createNotebook, createFolder, createPage,
    deleteNotebook, deleteFolder, deletePage,
    setActiveNotebook, selectPage, isSidebarOpen, toggleSidebar, renameNode,
    reorderNotebooks, moveNode, dominantHand
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current?.item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    if (active.id !== over.id) {
      // Check if it is a notebook reorder
      const isNotebookMove = notebooks.find(n => n.id === active.id);

      if (isNotebookMove) {
        // Notebooks can be reordered relative to other notebooks (which are items)
        // Or dropped into the "root-notebooks" container (append)
        // If dropped on container-root-notebooks
        if (over.id === 'container-root-notebooks' || notebooks.find(n => n.id === over.id)) {
          // For notebooks, we currently only support reordering, so we can ignore container drops for now
          // or treating them as "move to end".
          // Let's pass the raw ID and let store handle or just ignore container drops for notebooks for now if strict reorder.
          // Simpler: If container, assume swap with last? Or separate action?
          // Existing reorderNotebooks expects 'overId' to be an item.
          if (over.id === 'container-root-notebooks') {
            // append to end?
            // Not implemented in reorderNotebooks yet. keeping simple.
            return;
          }
          reorderNotebooks(active.id as string, over.id as string);
        }
      } else {
        // Content move
        const overIdString = over.id as string;
        if (overIdString.startsWith('container-')) {
          // Dropped onto a column (empty space) -> Append to that container
          const containerId = overIdString.replace('container-', '');

          // CONSTRAINT: Cannot drop content (Folder/Page) into 'root-notebooks' container
          if (containerId === 'root-notebooks') {
            return;
          }

          moveNode(active.id as string, containerId, true);
        } else {
          // Dropped onto an item.
          // Check if it is a Notebook
          const isOverNotebook = notebooks.find(n => n.id === overIdString);
          if (isOverNotebook) {
            // Dropped content onto a Notebook Item -> Move Into (Container Drop)
            moveNode(active.id as string, overIdString, true);
          } else {
            // Check if it's a folder and NOT a sibling
            const overItem = folders[overIdString] || pages[overIdString];
            const isOverFolder = folders[overIdString];
            const activeItem = folders[active.id] || pages[active.id];

            if (isOverFolder && activeItem && activeItem.parentId !== overItem.parentId) {
              // Non-sibling folder -> Move Into
              moveNode(active.id as string, overIdString, true);
            } else {
              // Sibling or over a page -> Reorder
              moveNode(active.id as string, overIdString, false);
            }
          }
        }
      }
    }
  };


  const columns = useMemo(() => {

    // Recursive check helper: is 'childId' a descendant of 'parentId'?
    const isDescendant = (childFolderId: string, potentialAncestorId: string): boolean => {
      let current = folders[childFolderId];
      while (current) {
        if (current.id === potentialAncestorId) return true;
        if (!current.parentId) return false;
        current = folders[current.parentId];
      }
      return false;
    };


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
      if (activeDragItem && isDescendant(parentId, activeDragItem.id)) {
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
  }, [notebooks, folders, pages, activePath, activeNotebookId, activePageId, setActiveNotebook, createFolder, createPage, selectPage, renameNode, createNotebook, activeDragItem]);

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
      sensors={sensors}
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
            onRename={renameNode}
            onDelete={col.onDelete}
            type={col.type}
            activeDragItem={activeDragItem}
          />
        ))}
      </div>

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
          let svgWidth = 250;
          let viewBox = "0 0 250 40";
          if (nameStrokes) {
            const bbox = getSvgPathBoundingBox(nameStrokes);
            if (bbox && !bbox.isEmpty) {
              const w = Math.max(250, bbox.x + bbox.width);
              svgWidth = w;
              viewBox = `0 0 ${w} 40`;
            }
          }

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
              <div className={styles.nameContainer}>
                <span className={styles.nameText}>{activeDragItem.name}</span>
                {nameStrokes && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      insetInlineStart: '8px',
                      width: `${svgWidth}px`,
                      minWidth: `${svgWidth}px`,
                      maxWidth: 'none',
                      height: '100%',
                      pointerEvents: 'none',
                      overflow: 'visible'
                    }}
                  >
                    <svg
                      viewBox={viewBox}
                      width={svgWidth}
                      height={32}
                      style={{ display: 'block' }}
                    >
                      <path d={nameStrokes} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>
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


