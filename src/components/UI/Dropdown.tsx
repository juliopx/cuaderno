import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  optionIcons?: Record<string, ReactNode>; // Optional icons for each option
  className?: string; // Additional wrapper class
  triggerClassName?: string; // Additional trigger class
  showChevron?: boolean; // New prop
  showLabel?: boolean; // New prop
  usePortal?: boolean; // New prop
  menuWidth?: number | string; // New prop for portal menu width
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
  optionIcons,
  className,
  triggerClassName,
  showChevron = true,
  showLabel = true,
  usePortal = true,
  menuWidth
}: DropdownProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [portalCoords, setPortalCoords] = useState<{ top: number, left: number, width: number | string } | null>(null);

  useEffect(() => {
    if (isOpen && usePortal && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPortalCoords({
        top: rect.bottom,
        left: rect.left,
        width: menuWidth || rect.width || (typeof width === 'number' ? width : 140)
      });
    }
  }, [isOpen, usePortal, width, menuWidth]);

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
        className={clsx(styles.trigger, isOpen && styles.open, triggerClassName)}
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
          {showLabel && displayLabel}
        </span>
        {showChevron && <ChevronDown size={14} className={clsx(styles.chevron, isOpen && styles.rotate)} />}
      </button>

      {isOpen && (() => {
        const menuContent = (
          <div
            className={clsx(styles.menu, usePortal && styles.portalMenu)}
            ref={menuRef}
            style={usePortal && portalCoords ? {
              position: 'fixed',
              top: `${portalCoords.top}px`,
              left: `${portalCoords.left}px`,
              width: typeof portalCoords.width === 'number' ? `${portalCoords.width}px` : portalCoords.width,
              zIndex: 9999,
              '--dropdown-width': typeof portalCoords.width === 'number' ? `${portalCoords.width}px` : portalCoords.width
            } as any : {}}
          >
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
                <div className={styles.itemContent}>
                  {optionIcons?.[opt.value] && <span className={styles.itemIcon}>{optionIcons[opt.value]}</span>}
                  <span>{opt.label}</span>
                </div>
                {value === opt.value && <Check size={14} />}
              </button>
            ))}
          </div>
        );

        return usePortal ? createPortal(menuContent, document.body) : menuContent;
      })()}
    </div>
  );
};
