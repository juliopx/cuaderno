import { useState, useRef, useEffect } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Monitor, LogOut, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { useFileSystemStore } from '../../store/fileSystemStore';
import { useSyncStore } from '../../store/syncStore';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import clsx from 'clsx';
import googleDriveIcon from '../../assets/google-drive.svg';

export const Settings = () => {
  const { theme, setTheme, dominantHand, setDominantHand, language, setLanguage } = useFileSystemStore();
  const { t } = useTranslation();
  const leftHandedMode = dominantHand === 'left';
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
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Close main settings menu
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsLanguageOpen(false);
      }
      // Close language dropdown if clicked outside of it
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLanguageOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const deleteData = window.confirm(t('confirm_logout_delete_data'));
    await logout(deleteData);
    setIsOpen(false);
  };

  const themes = [
    { id: 'auto', icon: Monitor, label: t('theme_auto') },
    { id: 'light', icon: Sun, label: t('theme_light') },
    { id: 'dark', icon: Moon, label: t('theme_dark') },
  ];

  const languages = [
    { code: 'ar', label: 'العربية' },
    { code: 'ca', label: 'Català' },
    { code: 'de', label: 'Deutsch' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'eu', label: 'Euskera' },
    { code: 'fr', label: 'Français' },
    { code: 'gl', label: 'Galego' },
    { code: 'it', label: 'Italiano' },
    { code: 'nl', label: 'Nederlands' },
    { code: 'pl', label: 'Polski' },
    { code: 'pt', label: 'Português' },
    { code: 'ru', label: 'Русский' },
    { code: 'sv', label: 'Svenska' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'zh', label: '中文 (简体)' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
  ];

  const activeLanguageLabel = languages.find(l => l.code === language)?.label || 'English';

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
        title={t('settings')}
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
            <div className={styles.sectionTitle}>{t('language')}</div>
            <div className={styles.languageDropdownWrapper} ref={langMenuRef}>
              <button
                className={clsx(styles.dropdownTrigger, isLanguageOpen && styles.active)}
                onClick={() => setIsLanguageOpen(!isLanguageOpen)}
              >
                <span>{activeLanguageLabel}</span>
                <ChevronDown size={14} className={clsx(styles.chevron, isLanguageOpen && styles.rotate)} />
              </button>

              {isLanguageOpen && (
                <div className={styles.languageDropdown}>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      className={clsx(styles.languageOption, language === lang.code && styles.selected)}
                      onClick={() => {
                        setLanguage(lang.code as any);
                        setIsLanguageOpen(false);
                      }}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('theme')}</div>
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
            <div className={styles.sectionTitle}>{t('dominant_hand')}</div>
            <div className={styles.handGrid}>
              <button
                className={clsx(styles.handItem, dominantHand === 'left' && styles.handItemActive)}
                onClick={() => setDominantHand('left')}
              >
                <span>{t('hand_left')}</span>
              </button>
              <button
                className={clsx(styles.handItem, dominantHand === 'right' && styles.handItemActive)}
                onClick={() => setDominantHand('right')}
              >
                <span>{t('hand_right')}</span>
              </button>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('cloud_sync')}</div>
            {!isConfigured ? (
              <div className={styles.syncSection}>
                <button
                  className={styles.authButton}
                  onClick={() => authenticate()}
                  title={t('connect_google_drive')}
                >
                  <img src={googleDriveIcon} alt="Google Drive" />
                  <span>{t('connect_google_drive')}</span>
                </button>
              </div>
            ) : (
              <div className={styles.syncSection}>
                {user && (
                  <button
                    className={styles.userInfoButton}
                    onClick={handleLogout}
                    title={t('log_out')}
                  >
                    <img src={user.photo} alt={user.name} className={styles.userPhoto} />
                    <div className={styles.userName}>{user.name}</div>
                    <div className={styles.logoutIconWrapper}>
                      <LogOut size={18} />
                    </div>
                  </button>
                )}

                <div className={styles.toggleWrapper}>
                  <div className={styles.toggleLabel}>{t('auto_sync')}</div>
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
                  <span>{isSyncing ? t('syncing') : t('sync_now')}</span>
                </button>

                {lastSync && (
                  <div className={styles.lastSync}>
                    {t('last_sync', { time: new Date(lastSync).toLocaleTimeString() })}
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
