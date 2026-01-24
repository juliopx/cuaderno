import { useTranslation } from 'react-i18next';
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { UIPortal } from '../UIPortal';
import { CanvasTitle } from './CanvasTitle';
import styles from './CanvasArea.module.css';

interface WelcomeScreenProps {
  isSidebarOpen: boolean;
  activeNotebookId: string | null;
  activePath: string[]; // Adjust typing if needed
  dominantHand: 'left' | 'right';
  toggleSidebar: () => void;
}

export const WelcomeScreen = ({
  isSidebarOpen,
  activeNotebookId,
  activePath,
  dominantHand,
  toggleSidebar
}: WelcomeScreenProps) => {
  const { t } = useTranslation();
  const leftHandedMode = dominantHand === 'left';
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
};
