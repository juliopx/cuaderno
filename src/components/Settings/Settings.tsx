import { useState, useRef, useEffect } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Monitor, LogOut, RefreshCw } from 'lucide-react';
import { useFileSystemStore } from '../../store/fileSystemStore';
import { useSyncStore } from '../../store/syncStore';
import styles from './Settings.module.css';
import clsx from 'clsx';
import googleDriveIcon from '../../assets/google-drive.svg';

export const Settings = () => {
  const { theme, setTheme, leftHandedMode, setLeftHandedMode } = useFileSystemStore();
  const {
    isConfigured,
    isEnabled,
    setIsEnabled,
    authenticate,
    sync,
    status: syncStatus,
    lastSync,
    logout,
    user
  } = useSyncStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const deleteData = window.confirm('Do you want to delete all saved data in Google Drive before logging out?');
    await logout(deleteData);
    setIsOpen(false);
  };

  const themes = [
    { id: 'auto', icon: Monitor, label: 'Auto' },
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
  ];

  const isSyncing = syncStatus === 'syncing' || syncStatus === 'saving-to-disk';

  return (
    <div
      className={styles.wrapper}
      ref={menuRef}
      style={{
        '--settings-right': leftHandedMode ? 'auto' : '1rem',
        '--settings-left': leftHandedMode ? '1rem' : 'auto',
      } as React.CSSProperties}
    >
      <button
        className={clsx(styles.gearButton, isOpen && styles.active)}
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
      >
        <SettingsIcon size={20} />
      </button>

      {isOpen && (
        <div
          className={styles.menu}
          style={{
            '--menu-right': leftHandedMode ? 'auto' : '0',
            '--menu-left': leftHandedMode ? '0' : 'auto',
          } as React.CSSProperties}
        >
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Theme</div>
            <div className={styles.themeGrid}>
              {themes.map((t) => (
                <button
                  key={t.id}
                  className={clsx(styles.themeItem, theme === t.id && styles.themeItemActive)}
                  onClick={() => {
                    setTheme(t.id as any);
                    setIsOpen(false);
                  }}
                >
                  <t.icon size={16} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Accessibility</div>
            <div className={styles.toggleWrapper}>
              <div className={styles.toggleLabel}>Modo Zurdo</div>
              <div
                className={clsx(styles.toggle, leftHandedMode && styles.toggleActive)}
                onClick={() => setLeftHandedMode(!leftHandedMode)}
              >
                <div className={styles.toggleCircle} />
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Cloud Sync</div>
            {!isConfigured ? (
              <div className={styles.syncSection}>
                <button
                  className={styles.authButton}
                  onClick={() => authenticate()}
                  title="Connect to Google Drive to sync your notebooks across devices."
                >
                  <img src={googleDriveIcon} alt="Google Drive" />
                  <span>Connect Google Drive</span>
                </button>
              </div>
            ) : (
              <div className={styles.syncSection}>
                {user && (
                  <button
                    className={styles.userInfoButton}
                    onClick={handleLogout}
                    title="Click to Log Out"
                  >
                    <img src={user.photo} alt={user.name} className={styles.userPhoto} />
                    <div className={styles.userName}>{user.name}</div>
                    <div className={styles.logoutIconWrapper}>
                      <LogOut size={18} />
                    </div>
                  </button>
                )}

                <div className={styles.toggleWrapper}>
                  <div className={styles.toggleLabel}>Auto-sync</div>
                  <div
                    className={clsx(styles.toggle, isEnabled && styles.toggleActive)}
                    onClick={() => setIsEnabled(!isEnabled)}
                  >
                    <div className={styles.toggleCircle} />
                  </div>
                </div>

                <button
                  className={clsx(styles.authButton, isSyncing && styles.authButtonSyncing)}
                  onClick={() => sync(true)}
                  disabled={isSyncing}
                >
                  <RefreshCw size={18} className={clsx(isSyncing && styles.spin)} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                {lastSync && (
                  <div className={styles.lastSync}>
                    Last sync: {new Date(lastSync).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
