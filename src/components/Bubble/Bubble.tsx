import { useState, useRef, useEffect } from 'react';
import { useEditor, useIsDarkMode, getDefaultColorTheme } from 'tldraw';
import {
  DefaultColorStyle,
  DefaultSizeStyle,
  DefaultFontStyle,
  DefaultTextAlignStyle,
} from 'tldraw';
import styles from './Bubble.module.css';
import { useTextStyleStore } from '../../store/textStyleStore';
import { useFileSystemStore } from '../../store/fileSystemStore';
import clsx from 'clsx';
import { UIPortal } from '../UIPortal';

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Generic Scribble SVG
const Scribble = ({ strokeWidth, color = 'currentColor' }: { strokeWidth: number, color?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14c2-4 5-6 8-2s6 2 8 0" />
  </svg>
);

const useDraggableWithBounds = (initialPosition: { x: number, y: number }, width: number, height: number) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const hasMoved = useRef(false); // Track if significant movement occurred
  const startPos = useRef({ x: 0, y: 0 });
  const itemStartPos = useRef({ x: 0, y: 0 });

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only left click for mouse; all pointer types for touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // e.preventDefault(); // Don't prevent default on pointerdown or clicks might break
    isDragging.current = true;
    setIsDraggingState(true);
    hasMoved.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    itemStartPos.current = position;

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    // Capture the pointer to ensure we get events even if it leaves the element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    // Threshold for "drag vs click"
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved.current = true;
    }

    const newX = clamp(itemStartPos.current.x + dx, 0, window.innerWidth - width);
    const newY = clamp(itemStartPos.current.y + dy, 0, window.innerHeight - height);

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: PointerEvent) => {
    isDragging.current = false;
    setIsDraggingState(false);
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if already released or invalid
    }
  };

  // Adjust position on resize OR dimension change (e.g. collapse/expand) to keep it in bounds
  useEffect(() => {
    setPosition(p => ({
      x: clamp(p.x, 0, window.innerWidth - width),
      y: clamp(p.y, 0, window.innerHeight - height)
    }));
  }, [width, height]);

  // Window resize separate listener
  useEffect(() => {
    const handleResize = () => {
      setPosition(p => ({
        x: clamp(p.x, 0, window.innerWidth - width),
        y: clamp(p.y, 0, window.innerHeight - height)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  return { position, setPosition, handlePointerDown, hasMoved, isDragging: isDraggingState };
};

interface BubbleProps {
  activeTool: string;
}

// Custom Dropdown Component
const CustomDropdown = ({ value, options, labels, onChange, isOpen, onToggle, icon, width = '100%', hasMoved, applyFontToLabel = false }: any) => {
  return (
    <div className={styles.customDropdown} style={{ width }}>
      <button
        className={clsx(styles.dropdownTrigger, isOpen && styles.open)}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <span className={styles.dropdownLabel} style={applyFontToLabel && labels[value] ? { fontFamily: `var(--tl - font - ${value})` } : {}}>
          {icon && <span className={styles.dropdownIcon}>{icon}</span>}
          {labels[value] || value}
        </span>
        <ChevronDown size={14} className={styles.chevron} />
      </button>
      {isOpen && (
        <div className={styles.dropdownMenu} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          {options.map((opt: string) => (
            <button
              key={opt}
              className={clsx(styles.dropdownItem, value === opt && styles.selected)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                if (!hasMoved.current) {
                  onChange(opt);
                  onToggle(); // Close
                }
              }}
              style={applyFontToLabel ? { fontFamily: `var(--tl - font - ${opt})` } : {}}
            >
              {labels[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Bubble = ({ activeTool }: BubbleProps) => {
  const { t } = useTranslation();
  const editor = useEditor();
  const isDarkMode = useIsDarkMode();
  const theme = getDefaultColorTheme({ isDarkMode });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFontOpen, setIsFontOpen] = useState(false);
  const [isSizeOpen, setIsSizeOpen] = useState(false);
  const [relativeClickPoint, setRelativeClickPoint] = useState({ x: 0, y: 0 });

  const textStyles = useTextStyleStore();

  const editingId = editor.getEditingShapeId();
  const editingShape = editingId ? editor.getShape(editingId) : null;
  const isEditingRichText = editingShape?.type === 'rich-text';

  // Colors mapping (using Tldraw's actual theme engine for 100% match)
  const colorsMap: Record<string, string> = {
    black: theme.black.solid,
    grey: theme.grey.solid,
    red: theme.red.solid,
    yellow: theme.yellow.solid,
    green: theme.green.solid,
    blue: theme.blue.solid,
    violet: theme.violet.solid,
  };

  // Rich Text State (Persistent context, initialized from global store)
  const [richStats, setRichStats] = useState({
    bold: textStyles.bold,
    italic: textStyles.italic,
    underline: textStyles.underline,
    strike: textStyles.strike,
    font: textStyles.font,
    size: textStyles.size,
    color: textStyles.color,
    align: textStyles.align
  });

  // Sync state with cursor position
  useEffect(() => {
    const editingId = editor.getEditingShapeId();
    const editingShape = editingId ? editor.getShape(editingId) : null;
    const isRichText = editingShape?.type === 'rich-text';

    if (!isRichText) return;

    const updateStats = (e?: Event) => {
      // If we are typing, don't sync from DOM unless it's a specific navigation key
      if (e?.type === 'keydown') {
        const key = (e as KeyboardEvent).key;
        const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
        if (!navKeys.includes(key)) return;
      }

      const selection = window.getSelection();
      if (!selection || !selection.focusNode) return;

      const node = selection.focusNode.nodeType === 3 ? selection.focusNode.parentElement : (selection.focusNode as HTMLElement);
      if (!node || (!node.closest('.rich-text-container') && !node.classList.contains('rich-text-container'))) {
        return;
      }

      const computed = window.getComputedStyle(node);

      setRichStats(prev => {
        const next = {
          ...prev,
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strike: document.queryCommandState('strikethrough'),

          font: (() => {
            const family = document.queryCommandValue('fontName') || computed.fontFamily;
            if (family.includes('Comic')) return 'draw';
            if (family.includes('Inter') || family.includes('sans-serif')) return 'sans';
            if (family.includes('serif')) return 'serif';
            if (family.includes('mono')) return 'mono';
            return prev.font;
          })(),

          size: (() => {
            const val = document.queryCommandValue('fontSize');
            if (val === '4' || val === '18px') return 's';
            if (val === '5' || val === '24px') return 'm';
            if (val === '6' || val === '32px') return 'l';
            if (val === '7' || val === '48px') return 'xl';

            const px = parseInt(computed.fontSize);
            if (px <= 18) return 's';
            if (px <= 26) return 'm';
            if (px <= 34) return 'l';
            return 'xl';
          })(),

          color: (() => {
            const val = document.queryCommandValue('foreColor');
            if (!val) return prev.color;
            const rgb = val.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
              const r = parseInt(rgb[0]), g = parseInt(rgb[1]), b = parseInt(rgb[2]);
              let closestKey = 'black';
              let minDiff = Infinity;
              for (const [key, hex] of Object.entries(colorsMap)) {
                const hr = parseInt(hex.slice(1, 3), 16);
                const hg = parseInt(hex.slice(3, 5), 16);
                const hb = parseInt(hex.slice(5, 7), 16);
                const diff = Math.abs(r - hr) + Math.abs(g - hg) + Math.abs(b - hb);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestKey = key;
                }
              }
              if (minDiff < 30) return closestKey;
            }
            return prev.color;
          })(),

          align: (() => {
            if (editingShape && (editingShape as any).props.align) {
              return (editingShape as any).props.align;
            }
            if (document.queryCommandState('justifyLeft')) return 'start';
            if (document.queryCommandState('justifyCenter')) return 'middle';
            if (document.queryCommandState('justifyRight')) return 'end';
            return 'start';
          })()
        };

        // Sync back to global "saved configuration"
        textStyles.updateStyles({
          bold: next.bold,
          italic: next.italic,
          underline: next.underline,
          strike: next.strike,
          font: next.font,
          size: next.size,
          color: next.color,
          align: next.align
        });

        return next;
      });
    };

    // Priming for NEW shapes
    const html = (editingShape?.props as any)?.html || '';
    const isNewNode = html === '' || html === '<div></div>' || html === `<div>${t('start_typing')}</div>` || html === t('start_typing');

    const applyPersistentStyles = () => {
      const active = document.activeElement as HTMLElement;
      if (active?.getAttribute('contenteditable') === 'true') {
        if (textStyles.bold) document.execCommand('bold');
        if (textStyles.italic) document.execCommand('italic');
        if (textStyles.underline) document.execCommand('underline');
        if (textStyles.strike) document.execCommand('strikethrough');

        const hex = colorsMap[textStyles.color] || '#000000';
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, hex);

        const fonts: Record<string, string> = {
          draw: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
          sans: 'Inter, sans-serif',
          serif: 'serif',
          mono: 'monospace'
        };
        document.execCommand('fontName', false, fonts[textStyles.font] || 'sans-serif');

        const sizes: Record<string, string> = { s: '3', m: '4', l: '5', xl: '6' };
        document.execCommand('fontSize', false, sizes[textStyles.size] || '4');

        setRichStats({
          bold: textStyles.bold,
          italic: textStyles.italic,
          underline: textStyles.underline,
          strike: textStyles.strike,
          font: textStyles.font,
          size: textStyles.size,
          color: textStyles.color,
          align: textStyles.align
        });
      } else {
        requestAnimationFrame(applyPersistentStyles);
      }
    };

    if (isNewNode) {
      requestAnimationFrame(applyPersistentStyles);
    } else {
      // For existing shapes, sync once on focus and then on events
      requestAnimationFrame(() => updateStats());
      document.addEventListener('pointerup', updateStats);
      document.addEventListener('keyup', updateStats);
    }

    return () => {
      document.removeEventListener('pointerup', updateStats);
      document.removeEventListener('keyup', updateStats);
    };
  }, [editor.getEditingShapeId(), t]);

  // 💡 PROACTIVE SYNC: When switching to text tool, push current persistent stats to Tldraw context
  // This ensures new shapes inherit the correct color/size from the very first frame.
  useEffect(() => {
    if (activeTool === 'text') {
      editor.setStyleForNextShapes(DefaultColorStyle, richStats.color);
      editor.setStyleForNextShapes(DefaultSizeStyle, richStats.size);
      editor.setStyleForNextShapes(DefaultFontStyle, richStats.font);

      // VALIDATION FIX: Sanitize 'justify' for Tldraw default style context
      const validAlign = richStats.align === 'justify' ? 'start' : richStats.align;
      editor.setStyleForNextShapes(DefaultTextAlignStyle, validAlign);
    }
  }, [activeTool, editor, richStats]);

  const toggleStyle = (command: string) => {
    const key = command === 'strikethrough' ? 'strike' : command;
    const editingId = editor.getEditingShapeId();
    const editingShape = editingId ? editor.getShape(editingId) : null;

    if (editingShape?.type === 'rich-text') {
      // Focus Restoration: If focus is lost to the button, restore it to the editor
      const active = document.activeElement;
      if (!active?.classList.contains('rich-text-container') && !active?.closest('.rich-text-container')) {
        const shapeEl = document.getElementById(editingShape.id)?.querySelector('.rich-text-container');
        if (shapeEl) {
          (shapeEl as HTMLElement).focus();
        }
      }

      document.execCommand(command);

      // Only update the shape props if the shape is empty.
      const isNewNode = (editingShape.props as any).html === '' || (editingShape.props as any).html === '<div></div>';
      if (isNewNode) {
        const currentVal = (editingShape.props as any)[key];
        editor.updateShape({
          id: editingShape.id,
          type: 'rich-text',
          props: { [key]: !currentVal }
        });
      }

      // Force sync stats and store
      setRichStats(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
      textStyles.updateStyles({ [key]: !(textStyles as any)[key] });
    } else {
      // Just update local state if no shape is being edited (e.g. strict selection)
      setRichStats(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
      textStyles.updateStyles({ [key]: !(textStyles as any)[key] });
    }
  };

  // Dimensions depend on state
  // Match CSS width: 300px for expanded, 48px for collapsed
  const width = isCollapsed ? 48 : 300;
  // Increase height for text tool (has font row)
  const height = isCollapsed ? 48 : (activeTool === 'text' ? 240 : 170);

  const { dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';
  const initialX = leftHandedMode ? 100 : window.innerWidth / 2 - 150;
  const { position, setPosition, handlePointerDown, hasMoved, isDragging } = useDraggableWithBounds({ x: initialX, y: 100 }, width, height);

  // Custom "Smart Double Click" handler
  const lastClickTime = useRef(0);
  const handleSmartClick = (e: React.MouseEvent) => {
    if (hasMoved.current) return;
    const now = Date.now();
    // If click interval < 300ms, treat as double click
    if (now - lastClickTime.current < 300) {
      // Store relative click point
      setRelativeClickPoint({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      // Collapse to click position (centered)
      const newX = e.clientX - 24;
      const newY = e.clientY - 24;
      setPosition({ x: newX, y: newY });
      setIsCollapsed(true);
    }
    lastClickTime.current = now;
  };

  const handleExpandCheck = () => {
    if (!hasMoved.current) {
      // Expand from current position (centered bubble) to relative point
      const newX = (position.x + 24) - relativeClickPoint.x;
      const newY = (position.y + 24) - relativeClickPoint.y;
      setPosition({ x: newX, y: newY });
      setIsCollapsed(false);
    }
  };

  const colors = Object.keys(colorsMap);

  // Size mapping to numbers for the SVG stroke width
  const sizeMap: Record<string, number> = {
    s: 1.5,
    m: 2.5,
    l: 4,
    xl: 6,
  };

  // Helper to set style
  const setStyle = (style: any, value: any) => {
    // 1. If editing a shape, update THAT shape's style
    const editingShapeId = editor.getEditingShapeId();
    if (editingShapeId) {
      const shape = editor.getShape(editingShapeId);

      // Rich Text Logic
      if (shape && shape.type === 'rich-text') {
        if (style.id === 'tldraw:color') {
          const hex = colorsMap[value] || '#000000';
          // Focus check
          const active = document.activeElement;
          if (!active?.classList.contains('rich-text-container')) {
            const shapeEl = document.getElementById(editingShapeId)?.querySelector('.rich-text-container');
            if (shapeEl) (shapeEl as HTMLElement).focus();
          }

          document.execCommand('styleWithCSS', false, 'true');
          document.execCommand('foreColor', false, hex);
          setRichStats(prev => ({ ...prev, color: value }));

          // If no selection, we should also update Tldraw's next shape style context
          // as the primary fallback since the browser's insertion style might get lost
          editor.setStyleForNextShapes(DefaultColorStyle, value);
          // Sync to Zustand global store
          textStyles.updateStyles({ color: value });
        }

        if (style.id === 'tldraw:font') {
          const fonts: Record<string, string> = {
            draw: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
            sans: 'Inter, sans-serif',
            serif: 'serif',
            mono: 'monospace'
          };
          document.execCommand('fontName', false, fonts[value] || 'sans-serif');
          setRichStats(prev => ({ ...prev, font: value }));
          editor.setStyleForNextShapes(DefaultFontStyle, value);
          textStyles.updateStyles({ font: value });
        }

        if (style.id === 'tldraw:size') {
          const sizes: Record<string, string> = { s: '4', m: '5', l: '6', xl: '7' };
          document.execCommand('fontSize', false, sizes[value] || '5');
          setRichStats(prev => ({ ...prev, size: value }));
          editor.setStyleForNextShapes(DefaultSizeStyle, value);
          textStyles.updateStyles({ size: value });
        }

        if (style.id === 'tldraw:textAlign') {
          setRichStats(prev => ({ ...prev, align: value }));
          // No execCommand for alignment -> Treat as Global Shape Prop
          // Note: Alignment updates the whole shape via the updateShape below
        }
      }

      // Map style ID to prop key
      const propKey = style.id.replace('tldraw:', '');
      const finalPropKey = propKey === 'textAlign' ? 'align' : propKey;

      // Only update shape props if:
      // 1. It's an alignment change (always global)
      // 2. The shape is empty (save defaults)
      const isAlignment = finalPropKey === 'align';
      const isNewNode = shape && ((shape.props as any).html === '' || (shape.props as any).html === '<div></div>');

      if (shape && (isAlignment || isNewNode)) {
        editor.updateShape({
          id: editingShapeId,
          type: shape.type,
          props: { [finalPropKey]: value }
        } as any);
      } else {
        // Just update next shape style context for Tldraw
        if ('setStyleForNextShapes' in editor) {
          editor.setStyleForNextShapes(style, value);
        }
      }
      return;
    }

    // 2. Set for currently selected shapes
    if (editor.getSelectedShapes().length > 0) {
      // VALIDATION FIX: Manual update for 'justify' to avoid schema validation error
      if (style.id === 'tldraw:textAlign' && value === 'justify') {
        const selected = editor.getSelectedShapes();
        const updates = selected
          .filter(s => s.type === 'rich-text')
          .map(s => ({
            id: s.id,
            type: 'rich-text',
            props: { align: 'justify' }
          }));
        if (updates.length > 0) {
          editor.updateShapes(updates as any);
        }
      } else {
        editor.setStyleForSelectedShapes(style, value);
      }
    }
    // 3. Set for future shapes (context)
    if ('setStyleForNextShapes' in editor) {
      // VALIDATION FIX: 'justify' is not a valid value for Tldraw's DefaultTextAlignStyle (start, middle, end)
      // We only pass it to the editor context if it matches the schema.
      // For 'justify', we rely on our custom store (useTextStyleStore) which injects it into props.
      if (style.id === 'tldraw:textAlign' && value === 'justify') {
        // Do not update Tldraw's default style context for justify
        // or fallback to start
        (editor as any).setStyleForNextShapes(style, 'start');
      } else {
        (editor as any).setStyleForNextShapes(style, value);
      }
    }

    // 4. Update richStats for immediate UI feedback (Pending Styles)
    const propKey = style.id.replace('tldraw:', '');
    const finalPropKey = propKey === 'textAlign' ? 'align' : propKey;
    setRichStats(prev => ({ ...prev, [finalPropKey]: value }));
    textStyles.updateStyles({ [finalPropKey]: value });
  };

  // Show for:
  // 1. Draw Tool
  // 2. Text Tool
  // 3. Selection Tool IF we are editing Rich Text
  if (activeTool !== 'draw' && activeTool !== 'text' && !(activeTool === 'select' && isEditingRichText)) {
    return null;
  }

  // Reactive reads (tracked)
  const getStyle = (style: any, fallback: string) => {
    // 1. Check Editing Shape
    const editingShapeId = editor.getEditingShapeId();
    if (editingShapeId) {
      const shape = editor.getShape(editingShapeId);
      // We need to map Tldraw style keys to shape props
      // Style IDs are usually 'tldraw:font', etc. Props are 'font'.
      if (shape && (shape as any).props) {
        const propKey = style.id.replace('tldraw:', '');
        if ((shape as any).props[propKey]) {
          return (shape as any).props[propKey];
        }
      }
    }

    // 2. Check selection
    const sharedStyles = editor.getSharedStyles();
    const shared = sharedStyles.get(style);
    if (shared && shared.type === 'shared') {
      return shared.value;
    }
    // 3. Check next shape style (tool state)
    if ('getStyleForNextShape' in editor) {
      return (editor as any).getStyleForNextShape(style);
    }
    return fallback;
  };

  // Determine current active styles for the UI
  const isTextMode = activeTool === 'text' || isEditingRichText;
  const currentSize = isTextMode ? richStats.size : ((getStyle(DefaultSizeStyle, 'm') as string) || richStats.size || 'm');
  const currentColor = isTextMode ? richStats.color : ((getStyle(DefaultColorStyle, 'black') as string) || richStats.color || 'black');
  const currentFont = isTextMode ? richStats.font : ((getStyle(DefaultFontStyle, 'draw') as string) || richStats.font || 'draw');
  const activeColorHex = colorsMap[currentColor] || theme.black.solid;

  if (isCollapsed) {
    return (
      <UIPortal>
        <div
          className={clsx(styles.bubble, styles.collapsed, isDragging && styles.dragging)}
          style={{
            left: position.x,
            top: position.y,
            backgroundColor: 'var(--glass-bg)',
            pointerEvents: 'auto'
          }}
          onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e); }}
          onClick={handleExpandCheck}
          data-is-ui="true"
        >
          {activeTool === 'text' || isEditingRichText ? (
            <div style={{
              fontFamily: `var(--tl - font - ${currentFont})`,
              color: activeColorHex,
              fontSize: '24px',
              fontWeight: richStats.bold ? 'bold' : 'normal',
              fontStyle: richStats.italic ? 'italic' : 'normal',
              textDecoration: [
                richStats.underline ? 'underline' : '',
                richStats.strike ? 'line-through' : ''
              ].filter(Boolean).join(' ') || 'none',
              pointerEvents: 'none'
            }}>
              A
            </div>
          ) : (
            <Scribble strokeWidth={sizeMap[currentSize] || 2.5} color={activeColorHex} />
          )}
        </div>
      </UIPortal>
    );
  }

  return (
    <UIPortal>
      <div
        className={clsx(styles.bubble, isDragging && styles.dragging)}
        style={{ left: position.x, top: position.y, pointerEvents: 'auto' }}
        onPointerDown={handlePointerDown}
        onClick={handleSmartClick}
        data-is-ui="true"
      >
        {(activeTool === 'text' || (activeTool === 'select' && isEditingRichText)) && (
          <div className={styles.textSettings}>
            <div className={styles.topRow}>
              <div className={styles.dropdownsGroup}>
                <CustomDropdown
                  value={currentFont}
                  options={['draw', 'sans', 'serif', 'mono']}
                  labels={{
                    draw: t('font_draw'),
                    sans: t('font_sans'),
                    serif: t('font_serif'),
                    mono: t('font_mono'),
                  }}
                  onChange={(f: string) => setStyle(DefaultFontStyle, f)}
                  isOpen={isFontOpen}
                  onToggle={() => { setIsFontOpen(!isFontOpen); setIsSizeOpen(false); }}
                  width="140px"
                  hasMoved={hasMoved}
                  applyFontToLabel
                />
                <CustomDropdown
                  value={currentSize}
                  options={['s', 'm', 'l', 'xl']}
                  labels={{
                    s: t('font_size_s'),
                    m: t('font_size_m'),
                    l: t('font_size_l'),
                    xl: t('font_size_xl'),
                  }}
                  onChange={(s: string) => setStyle(DefaultSizeStyle, s)}
                  isOpen={isSizeOpen}
                  onToggle={() => { setIsSizeOpen(!isSizeOpen); setIsFontOpen(false); }}
                  width="120px"
                  hasMoved={hasMoved}
                />
              </div>
            </div>
            <div className={styles.toolsRow}>
              <div className={styles.styleGroup}>
                <button
                  className={clsx(styles.iconBtn, richStats.bold && styles.active)}
                  onClick={(e) => { e.stopPropagation(); !hasMoved.current && toggleStyle('bold'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_bold')}
                >
                  <Bold size={16} />
                </button>
                <button
                  className={clsx(styles.iconBtn, richStats.italic && styles.active)}
                  onClick={(e) => { e.stopPropagation(); !hasMoved.current && toggleStyle('italic'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_italic')}
                >
                  <Italic size={16} />
                </button>
                <button
                  className={clsx(styles.iconBtn, richStats.underline && styles.active)}
                  onClick={(e) => { e.stopPropagation(); !hasMoved.current && toggleStyle('underline'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_underline')}
                >
                  <Underline size={16} />
                </button>
                <button
                  className={clsx(styles.iconBtn, richStats.strike && styles.active)}
                  onClick={(e) => { e.stopPropagation(); !hasMoved.current && toggleStyle('strikethrough'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_strikethrough')}
                >
                  <Strikethrough size={16} />
                </button>
              </div>
              <div className={styles.styleGroup}>
                {['start', 'middle', 'end', 'justify'].filter(h => {
                  if (h === 'justify') {
                    const isAuto = (editingShape as any)?.props?.autoSize ?? true;
                    return !isAuto;
                  }
                  return true;
                }).map((h) => {
                  const isActive = isEditingRichText ? richStats.align === h : getStyle(DefaultTextAlignStyle, 'start') === h;
                  return (
                    <button
                      key={h}
                      className={clsx(styles.iconBtn, isActive && styles.active)}
                      onClick={() => {
                        if (!hasMoved.current) {
                          setStyle(DefaultTextAlignStyle, h);
                        }
                      }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      title={t(`align_${h === 'middle' ? 'middle' : (h === 'end' ? 'end' : h)}`)}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="4" width="12" height="1.5" rx="0.75" />
                        <rect
                          x={h === 'start' ? 2 : (h === 'middle' ? 4 : (h === 'end' ? 6 : 2))}
                          y="7.25"
                          width={h === 'justify' ? 12 : 8} height="1.5" rx="0.75"
                        />
                        <rect
                          x={h === 'start' ? 2 : (h === 'middle' ? 3 : (h === 'end' ? 4 : 2))}
                          y="10.5"
                          width={h === 'justify' ? 12 : 10} height="1.5" rx="0.75"
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {activeTool === 'draw' && (
          <div className={styles.sizeRow}>
            <button
              className={clsx(styles.sizeBtn, currentSize === 's' && styles.active)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => !hasMoved.current && setStyle(DefaultSizeStyle, 's')}
            >
              <Scribble strokeWidth={1.5} color={activeColorHex} />
            </button>
            <button
              className={clsx(styles.sizeBtn, currentSize === 'm' && styles.active)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => !hasMoved.current && setStyle(DefaultSizeStyle, 'm')}
            >
              <Scribble strokeWidth={2.5} color={activeColorHex} />
            </button>
            <button
              className={clsx(styles.sizeBtn, currentSize === 'l' && styles.active)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => !hasMoved.current && setStyle(DefaultSizeStyle, 'l')}
            >
              <Scribble strokeWidth={4} color={activeColorHex} />
            </button>
            <button
              className={clsx(styles.sizeBtn, currentSize === 'xl' && styles.active)}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => !hasMoved.current && setStyle(DefaultSizeStyle, 'xl')}
            >
              <Scribble strokeWidth={6} color={activeColorHex} />
            </button>
          </div>
        )}
        <div className={styles.colorsRow}>
          {colors.map(c => (
            <button
              key={c}
              className={clsx(styles.colorSwatch, currentColor === c && styles.activeColor)}
              style={{
                backgroundColor: colorsMap[c],
                boxShadow: currentColor === c
                  ? `0 0 0 2px var(--glass-bg), 0 0 0 4px ${colorsMap[c]}`
                  : undefined
              }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => !hasMoved.current && setStyle(DefaultColorStyle, c)}
            />
          ))}
        </div>
      </div>
    </UIPortal >
  );
};
