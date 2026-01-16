import { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronDown, Check } from 'lucide-react';
import styles from './Dropdown.module.css';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  options: (string | DropdownOption)[];
  onChange: (value: string) => void;
  labels?: Record<string, string>; // Optional mapping if options are strings
  placeholder?: string;
  icon?: ReactNode;
  width?: string | number;
  isOpen: boolean;
  onToggle: () => void;
  applyFontToLabel?: boolean; // Special prop for font dropdown
  className?: string; // Additional wrapper class
}

export const Dropdown = ({
  value,
  options,
  onChange,
  labels,
  placeholder,
  icon,
  width,
  isOpen,
  onToggle,
  applyFontToLabel = false,
  className
}: DropdownProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        onToggle();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  // Normalize options to objects
  const normalizedOptions: DropdownOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: labels?.[opt] || opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find(o => o.value === value);
  const displayLabel = selectedOption?.label || placeholder || value;

  return (
    <div
      className={clsx(styles.wrapper, className)}
      style={{ width }}
      ref={wrapperRef}
      onMouseDown={(e) => e.stopPropagation()} // Prevent Tldraw canvas interactions
    >
      <button
        className={clsx(styles.trigger, isOpen && styles.open)}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        type="button"
      >
        <span
          className={styles.triggerLabel}
          style={applyFontToLabel && value ? { fontFamily: `var(--tl-font-${value})` } : {}}
        >
          {icon && <span className={styles.icon}>{icon}</span>}
          {displayLabel}
        </span>
        <ChevronDown size={14} className={clsx(styles.chevron, isOpen && styles.rotate)} />
      </button>

      {isOpen && (
        <div className={styles.menu} ref={menuRef}>
          {normalizedOptions.map((opt) => (
            <button
              key={opt.value}
              className={clsx(styles.item, value === opt.value && styles.selected)}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                onToggle();
              }}
              style={applyFontToLabel ? { fontFamily: `var(--tl-font-${opt.value})` } : {}}
              type="button"
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
