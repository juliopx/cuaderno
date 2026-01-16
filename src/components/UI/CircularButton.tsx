import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './CircularButton.module.css';

interface CircularButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  isActive?: boolean;
}

export const CircularButton = ({
  icon,
  isActive,
  className,
  ...props
}: CircularButtonProps) => {
  return (
    <button
      className={clsx(styles.button, isActive && styles.active, className)}
      type="button"
      {...props}
    >
      {icon}
    </button>
  );
};
