import { useMemo, Fragment } from 'react';
import { useFileSystemStore } from '../../store/fileSystemStore';
import { useTranslation } from 'react-i18next';
import styles from './CanvasTitle.module.css';
import { getSvgPathBoundingBox } from '../../lib/svgUtils';

interface PathItem {
  id: string;
  name: string;
  nameStrokes?: string;
}

const HybridPathItem = ({ item, isRtl }: { item: PathItem; isRtl: boolean }) => {
  const bbox = useMemo(() => {
    if (!item.nameStrokes) return null;
    return getSvgPathBoundingBox(item.nameStrokes);
  }, [item.nameStrokes]);

  const drawingWidth = (bbox && !bbox.isEmpty) ? bbox.x + bbox.width : 0;
  const svgWidth = Math.max(250, drawingWidth);
  const viewBox = `0 0 ${svgWidth} 40`;

  return (
    <div className={styles.itemWrapper}>
      <span className={styles.nameText}>{item.name}</span>
      {item.nameStrokes && (
        <div className={styles.drawingSpacer} style={{ width: drawingWidth }}>
          <div className={styles.strokeOverlay}>
            <svg
              viewBox={viewBox}
              width={svgWidth}
              height={40}
              style={{ display: 'block' }}
            >
              <path
                d={item.nameStrokes}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                transform={isRtl ? `translate(${svgWidth - drawingWidth}, 0)` : undefined}
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export const CanvasTitle = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const {
    activeNotebookId, notebooks, activePageId, pages, activePath, folders,
    isSidebarOpen, toggleSidebar, dominantHand
  } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';

  const activePage = activePageId ? pages[activePageId] : null;

  const breadcrumbItems = useMemo(() => {
    const items: PathItem[] = [];
    if (activeNotebookId) {
      const nb = notebooks.find(n => n.id === activeNotebookId);
      if (nb) items.push({ id: nb.id, name: nb.name, nameStrokes: (nb as any).nameStrokes });
    }
    activePath.forEach(id => {
      const folder = folders[id];
      if (folder) items.push({ id: folder.id, name: folder.name, nameStrokes: (folder as any).nameStrokes });
    });
    if (activePage) {
      items.push({ id: activePage.id, name: activePage.name, nameStrokes: activePage.nameStrokes });
    }
    return items;
  }, [activeNotebookId, activePath, activePage, notebooks, folders]);

  if (isSidebarOpen || breadcrumbItems.length === 0) return null;

  return (
    <div
      className={styles.container}
      style={{
        '--title-align': leftHandedMode ? 'flex-end' : 'flex-start',
        '--title-padding-left': leftHandedMode ? '1.5rem' : '5rem',
        '--title-padding-right': leftHandedMode ? '5rem' : '1.5rem',
      } as React.CSSProperties}
    >
      <div className={styles.breadcrumb} onClick={toggleSidebar} title={t('click_to_show_sidebar')}>
        {breadcrumbItems.map((item, i) => (
          <Fragment key={item.id}>
            <HybridPathItem item={item} isRtl={isRtl} />
            {i < breadcrumbItems.length - 1 && <span className={styles.separator}>/</span>}
          </Fragment>
        ))}
      </div>
    </div>
  );
};
