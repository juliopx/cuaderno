import { LogIn, AlertCircle } from 'lucide-react';
import styles from './SessionExpiredDialog.module.css';
import { useSyncStore } from '../store/syncStore';
import { useTranslation } from 'react-i18next';

export const SessionExpiredDialog = () => {
  const { isLoginDialogOpen, setLoginDialogOpen, authenticate } = useSyncStore();
  const { t } = useTranslation();

  if (!isLoginDialogOpen) return null;

  const handleLogin = async () => {
    try {
      await authenticate();
      setLoginDialogOpen(false);
    } catch (error) {
      console.error('Login failed from dialog', error);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            <AlertCircle size={28} />
          </div>
          <h2>{t('sessionExpired.title')}</h2>
        </div>

        <p className={styles.description}>
          {t('sessionExpired.description')}
        </p>

        <div className={styles.actions}>
          <button className={styles.loginButton} onClick={handleLogin}>
            <LogIn size={18} />
            {t('sessionExpired.login')}
          </button>

          <button
            className={styles.dismissButton}
            onClick={() => setLoginDialogOpen(false)}
          >
            {t('sessionExpired.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
};
