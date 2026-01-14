import styles from './ConflictModal.module.css';
import { useSyncStore } from '../store/syncStore';
import { AlertTriangle, Server, Monitor } from 'lucide-react';
import clsx from 'clsx';

export const ConflictModal = () => {
  const { status, conflicts, resolveConflict } = useSyncStore();

  if (status !== 'conflict' || !conflicts) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <AlertTriangle className={styles.warningIcon} size={24} />
          <h2>Sync Conflict</h2>
        </div>

        <p className={styles.description}>
          Divergent changes have been detected in Google Drive that cannot be merged automatically.
          Please select which version you want to keep.
        </p>

        <div className={styles.options}>
          <div className={styles.optionCard}>
            <div className={styles.optionHeader}>
              <Monitor size={20} />
              <h3>Local Version</h3>
            </div>
            <p className={styles.optionDescription}>
              Overwrite cloud changes with the current content from this device.
            </p>
            <button
              className={clsx(styles.button, styles.localButton)}
              onClick={() => resolveConflict('local')}
            >
              Keep Local
            </button>
          </div>

          <div className={styles.optionCard}>
            <div className={styles.optionHeader}>
              <Server size={20} />
              <h3>Cloud Version</h3>
            </div>
            <p className={styles.optionDescription}>
              Replace this device's content with the latest changes from Google Drive.
            </p>
            <button
              className={clsx(styles.button, styles.remoteButton)}
              onClick={() => resolveConflict('remote')}
            >
              Use Cloud
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <p className={styles.footerNote}>
            This action cannot be undone once synced.
          </p>
        </div>
      </div>
    </div>
  );
};
