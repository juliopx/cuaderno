import { useState, useRef, useEffect } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Monitor } from 'lucide-react';
import { useFileSystemStore } from '../../store/fileSystemStore';
import styles from './Settings.module.css';
import clsx from 'clsx';

export const Settings = () => {
  const { theme, setTheme } = useFileSystemStore();
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

  const themes = [
    { id: 'auto', icon: Monitor, label: 'Auto' },
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
  ];

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        className={clsx(styles.gearButton, isOpen && styles.active)}
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
      >
        <SettingsIcon size={20} />
      </button>

      {isOpen && (
        <div className={styles.menu}>
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
        </div>
      )}
    </div>
  );
};
