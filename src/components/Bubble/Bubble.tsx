import { useState, useRef, useEffect, useMemo } from 'react';
import {
  track,
  useEditor,
  useIsDarkMode,
  getDefaultColorTheme,
  DefaultColorStyle,
  DefaultSizeStyle,
  DefaultFontStyle,
  DefaultTextAlignStyle,
  DefaultDashStyle,
  DefaultFillStyle,
  GeoShapeGeoStyle,
} from 'tldraw';
import styles from './Bubble.module.css';
import { useUserPreferencesStore } from '../../store/userPreferencesStore';
import { useFileSystemStore } from '../../store/fileSystemStore';
import clsx from 'clsx';
import { UIPortal } from '../UIPortal';

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  Square,
  Circle,
  Triangle,
  Diamond,
  ArrowBigUp,
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
  Minus,
  Star,
  Hexagon,
  Cloud,
  Heart,
  Pentagon,
  Octagon,
  X,
  Check,
  Shapes,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LinkInputModal } from '../UI/LinkInputModal';
import {
  FillColorStyle,
  FillOpacityStyle,
  StrokeOpacityStyle,
} from '../../styles/customStyles';

// Generic Scribble SVG
const Scribble = ({ strokeWidth, color = 'currentColor' }: { strokeWidth: number, color?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14c2-4 5-6 8-2s6 2 8 0" />
  </svg>
);

const TrapezoidIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 5h8l4 10H2L6 5z" />
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

    // Don't drag if the event comes from the opacity slider
    const target = e.target as HTMLElement;
    if (target.classList.contains('opacitySlider') ||
      target.closest('.opacityRow') ||
      (target instanceof HTMLInputElement && target.type === 'range')) {
      return;
    }

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
    } catch {
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


export const Bubble = track(({ activeTool }: BubbleProps) => {
  const { t } = useTranslation();
  const editor = useEditor();
  const isDarkMode = useIsDarkMode();
  const theme = getDefaultColorTheme({ isDarkMode });
  const [isCollapsed, setIsCollapsed] = useState(false);
  // No longer using Dropdown states for text settings
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [relativeClickPoint, setRelativeClickPoint] = useState({ x: 0, y: 0 });
  const savedRange = useRef<Range | null>(null);

  const openLinkModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    } else {
      savedRange.current = null;
    }
    setIsLinkModalOpen(true);
  };

  const handleLinkConfirm = (url: string) => {
    const editingId = editor.getEditingShapeId();
    if (!editingId) {
      setIsLinkModalOpen(false);
      return;
    }

    const shapeEl = document.getElementById(editingId)?.querySelector('.rich-text-container');
    if (shapeEl) {
      (shapeEl as HTMLElement).focus();

      // Ensure we hit the next frame for focus and range to be fully restored
      setTimeout(() => {
        const selection = window.getSelection();
        if (savedRange.current && selection) {
          selection.removeAllRanges();
          selection.addRange(savedRange.current);
        }

        const currentSelection = window.getSelection();
        if (currentSelection && currentSelection.isCollapsed) {
          // If no selection, insert the URL as the link text
          document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`);
        } else {
          // If there is a selection, wrap it in a link
          document.execCommand('createLink', false, url);
        }
        setIsLinkModalOpen(false);
        savedRange.current = null;
      }, 50);
    } else {
      setIsLinkModalOpen(false);
    }
  };

  const userPrefs = useUserPreferencesStore();

  const editingId = editor.getEditingShapeId();
  const editingShape = editingId ? editor.getShape(editingId) : null;
  const isEditingRichText = editingShape?.type === 'rich-text';

  const selectedShapes = editor.getSelectedShapes();
  const hasSelectedShapes = selectedShapes.length > 0;
  const isSelectTool = activeTool === 'select';
  const isShapeTool = activeTool === 'draw' || activeTool === 'geo' || activeTool === 'arrow' || activeTool === 'line' || activeTool === 'shapes';
  const isTextTool = activeTool === 'text';

  const TEXT_TYPES = ['text', 'rich-text'];
  const SHAPE_TYPES = ['geo', 'arrow', 'line'];
  const DRAW_TYPES = ['draw'];
  const IMAGE_TYPES = ['image', 'asset'];

  const allSelectedMatch = (types: string[]) =>
    selectedShapes.length > 0 && selectedShapes.every(s => types.includes(s.type));

  const isAllText = allSelectedMatch(TEXT_TYPES);
  const isAllShape = allSelectedMatch(SHAPE_TYPES);
  const isAllDraw = allSelectedMatch(DRAW_TYPES);
  const isAllImage = allSelectedMatch(IMAGE_TYPES);

  // Colors mapping (using Tldraw's actual theme engine for 100% match)
  const colorsMap: Record<string, string> = useMemo(() => ({
    black: theme.black.solid,
    grey: theme.grey.solid,
    red: theme.red.solid,
    yellow: theme.yellow.solid,
    green: theme.green.solid,
    blue: theme.blue.solid,
    violet: theme.violet.solid,
  }), [theme]);

  // Rich Text State (Persistent context, initialized from global store)
  const [richStats, setRichStats] = useState({
    bold: userPrefs.textBold,
    italic: userPrefs.textItalic,
    underline: userPrefs.textUnderline,
    strike: userPrefs.textStrike,
    font: userPrefs.textFont,
    size: userPrefs.textSize,
    color: userPrefs.textColor,
    align: userPrefs.textAlign
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
            if (val === '3' || val === '14px') return 'xs';
            if (val === '4' || val === '18px') return 's';
            if (val === '5' || val === '24px') return 'm';
            if (val === '6' || val === '32px') return 'l';
            if (val === '7' || val === '48px') return 'xl';

            const px = parseInt(computed.fontSize);
            if (px <= 14) return 'xs';
            if (px <= 18) return 's';
            if (px <= 26) return 'm';
            if (px <= 34) return 'l';
            if (px <= 50) return 'xl';
            return 'xxl';
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
        userPrefs.updatePreferences({
          textBold: next.bold,
          textItalic: next.italic,
          textUnderline: next.underline,
          textStrike: next.strike,
          textFont: next.font,
          textSize: next.size,
          textColor: next.color,
          textAlign: next.align
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
        if (userPrefs.textBold) document.execCommand('bold');
        if (userPrefs.textItalic) document.execCommand('italic');
        if (userPrefs.textUnderline) document.execCommand('underline');
        if (userPrefs.textStrike) document.execCommand('strikethrough');

        const hex = colorsMap[userPrefs.textColor] || '#000000';
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, hex);

        const fonts: Record<string, string> = {
          draw: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
          sans: 'Inter, sans-serif',
          serif: 'serif',
          mono: 'monospace'
        };
        document.execCommand('fontName', false, fonts[userPrefs.textFont] || 'sans-serif');

        const sizes: Record<string, string> = { xs: '3', s: '4', m: '5', l: '6', xl: '7', xxl: '7' };
        document.execCommand('fontSize', false, sizes[userPrefs.textSize] || '4');

        setRichStats({
          bold: userPrefs.textBold,
          italic: userPrefs.textItalic,
          underline: userPrefs.textUnderline,
          strike: userPrefs.textStrike,
          font: userPrefs.textFont,
          size: userPrefs.textSize,
          color: userPrefs.textColor,
          align: userPrefs.textAlign
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
  }, [editor, t, colorsMap, userPrefs]);

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
  }, [activeTool, editor, richStats.color, richStats.size, richStats.font, richStats.align]);

  // 💡 SYNC FROM SELECTION: When selecting text objects, sync bubble stats from the first one
  useEffect(() => {
    if (isSelectTool && isAllText && selectedShapes[0]) {
      const first = selectedShapes[0] as any;
      const html = first.props.html || '';

      // Heuristic to detect if style is active in HTML (since we force global prop to false for these)
      const hasStrike = html.includes('line-through') || html.includes('<s>') || html.includes('<strike>') || html.includes('<del>');
      const hasUnderline = html.includes('underline') || html.includes('<u>');

      setRichStats({
        bold: first.props.bold || false,
        italic: first.props.italic || false,
        underline: first.props.underline || hasUnderline, // Trust prop OR html
        strike: first.props.strike || hasStrike,           // Trust prop OR html
        font: first.props.font || 'draw',
        size: first.props.size || 'm',
        color: first.props.color || 'black',
        align: first.props.align || 'start'
      });
    }
  }, [selectedShapes, isSelectTool, isAllText]);

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
      setRichStats(prev => {
        const next = { ...prev, [key]: !prev[key as keyof typeof prev] };
        const storeKey = `text${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof userPrefs;
        userPrefs.updatePreferences({ [storeKey]: next[key as keyof typeof next] });
        return next;
      });
    } else {
      // 💡 SELECTION MODE: Apply property to all selected text shapes
      if (selectedShapes.length > 0) {
        const textUpdates = selectedShapes
          .filter(s => s.type === 'rich-text')
          .map(s => {
            const propValue = (s.props as any)[key];
            let isActive = propValue;

            // For decorators, check HTML too because we might have forced prop to false
            if (key === 'strike') {
              const html = (s.props as any).html || '';
              isActive = propValue || html.includes('line-through') || html.includes('<s>') || html.includes('<strike>') || html.includes('<del>');
            } else if (key === 'underline') {
              const html = (s.props as any).html || '';
              isActive = propValue || html.includes('underline') || html.includes('<u>');
            }

            const newValue = !isActive;

            // Prevent double rendering: For strike/underline, ALWAYS set global prop to false
            // The visual style is handled by the HTML content update
            const newPropValue = (key === 'strike' || key === 'underline') ? false : newValue;

            return {
              id: s.id,
              type: 'rich-text',
              props: {
                [key]: newPropValue,
                // Unified HTML: Apply or remove style based on new value
                html: applyStyleToRichText((s.props as any).html, key, newValue)
              }
            };
          });

        if (textUpdates.length > 0) {
          editor.updateShapes(textUpdates as any);
        }
      }

      // Sync local state and store
      setRichStats(prev => {
        // Toggle the UI state based on the assumption that we successfully toggled it
        const next = { ...prev, [key]: !prev[key as keyof typeof prev] };
        const storeKey = `text${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof userPrefs;
        userPrefs.updatePreferences({ [storeKey]: next[key as keyof typeof next] });
        return next;
      });
    }
  };

  // Dimensions depend on state
  // Match CSS width: 340px for expanded, 48px for collapsed
  const width = isCollapsed ? 48 : 340;
  // Increase height for shapes tool (has options)
  const height = isCollapsed ? 48 : (activeTool === 'text' ? 240 : (activeTool === 'shapes' ? 300 : 170));

  const { dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';
  const initialX = leftHandedMode ? 100 : window.innerWidth / 2 - 170;
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
    xs: 1,
    s: 1.5,
    m: 2.5,
    l: 4,
    xl: 6,
    xxl: 10,
  };

  /**
   * Applies a style strictly to all elements within the rich-text content,
   * preserving structure but enforcing the new property value on every node.
   * This replaces the old "unify" behavior which stripped styles and wrapped globally.
   */
  const applyStyleToRichText = (html: string, prop: string, value: any): string => {
    if (!html) return html;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const elements = Array.from(tempDiv.querySelectorAll('*'));
    // Also include the root if it's not empty (though querySelectorAll('*') gets children)
    // Tldraw rich text is usually <div>...</div>. The tempDiv wraps it.
    // If the content is just text, it might be directly in tempDiv.
    // However, usually we want to target the tags.

    if (elements.length === 0 && tempDiv.textContent?.trim()) {
      // If pure text, wrap it so we can style it
      const wrapper = document.createElement('span');
      while (tempDiv.firstChild) {
        wrapper.appendChild(tempDiv.firstChild);
      }
      tempDiv.appendChild(wrapper);
      elements.push(wrapper);
    }

    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;

      if (prop === 'color') {
        htmlEl.style.color = value;
      }
      if (prop === 'font') {
        const fonts: Record<string, string> = {
          draw: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
          sans: 'Inter, sans-serif',
          serif: 'serif',
          mono: 'monospace'
        };
        htmlEl.style.fontFamily = fonts[value] || 'sans-serif';
      }
      if (prop === 'size') htmlEl.style.fontSize = '';

      if (prop === 'size') htmlEl.style.fontSize = '';
      if (prop === 'font') htmlEl.style.fontFamily = '';
      if (prop === 'align') htmlEl.style.textAlign = '';

      // Toggles
      if (prop === 'bold') {
        if (value) {
          htmlEl.style.fontWeight = 'bold';
        } else {
          htmlEl.style.fontWeight = 'normal';
          if (htmlEl.tagName === 'B' || htmlEl.tagName === 'STRONG') {
            htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
          }
        }
      }
      if (prop === 'italic') {
        if (value) {
          htmlEl.style.fontStyle = 'italic';
        } else {
          htmlEl.style.fontStyle = 'normal';
          if (htmlEl.tagName === 'I' || htmlEl.tagName === 'EM') {
            htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
          }
        }
      }
      if (prop === 'underline') {
        const current = htmlEl.style.textDecoration;
        let parts = current.split(' ').map(s => s.trim()).filter(Boolean);
        if (value) {
          if (!parts.includes('underline')) parts.push('underline');
        } else {
          parts = parts.filter(p => p !== 'underline');
          if (htmlEl.tagName === 'U') {
            htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
            return; // Element is gone, stop processing it
          }
        }
        htmlEl.style.textDecoration = parts.join(' ');
      }
      if (prop === 'strike') {
        const current = htmlEl.style.textDecoration;
        let parts = current.split(' ').map(s => s.trim()).filter(Boolean);
        if (value) {
          // 'line-through' is standard
          if (!parts.includes('line-through')) parts.push('line-through');
        } else {
          parts = parts.filter(p => p !== 'line-through');
          if (htmlEl.tagName === 'S' || htmlEl.tagName === 'STRIKE' || htmlEl.tagName === 'DEL') {
            htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
            return; // Element is gone
          }
        }
        htmlEl.style.textDecoration = parts.join(' ');
      }
    });

    return tempDiv.innerHTML;
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
          userPrefs.updatePreferences({ textColor: value });
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
          userPrefs.updatePreferences({ textFont: value });
        }

        if (style.id === 'tldraw:size') {
          const sizes: Record<string, string> = { xs: '3', s: '4', m: '5', l: '6', xl: '7', xxl: '7' };
          document.execCommand('fontSize', false, sizes[value] || '5');
          setRichStats(prev => ({ ...prev, size: value }));
          editor.setStyleForNextShapes(DefaultSizeStyle, value);
          userPrefs.updatePreferences({ textSize: value });
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
      const selected = editor.getSelectedShapes();
      const propKey = style.id.replace('tldraw:', '');
      const finalPropKey = propKey === 'textAlign' ? 'align' : propKey;

      // 💡 DEEP UNIFICATION: For rich-text shapes, unify internal HTML when property changes
      const textUpdates = selected
        .filter(s => s.type === 'rich-text')
        .map(s => ({
          id: s.id,
          type: 'rich-text',
          props: {
            [finalPropKey]: value,
            html: applyStyleToRichText((s.props as any).html, finalPropKey, value)
          }
        }));

      if (textUpdates.length > 0) {
        editor.updateShapes(textUpdates as any);
      }

      // VALIDATION FIX: Manual update for 'justify' to avoid schema validation error
      if (style.id === 'tldraw:textAlign' && value === 'justify') {
        // Already handled in textUpdates above for rich-text
      } else {
        editor.setStyleForSelectedShapes(style, value);
      }
    }
    // 3. Set for future shapes (context)
    if ('setStyleForNextShapes' in editor) {
      // VALIDATION FIX: 'justify' is not a valid value for Tldraw's DefaultTextAlignStyle (start, middle, end)
      // We only pass it to the editor context if it matches the schema.
      // For 'justify', we rely on our custom store (useUserPreferencesStore) which injects it into props.
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

    // Persist to store
    const prefUpdate: any = {};
    if (style.id === DefaultColorStyle.id) {
      prefUpdate.textColor = value;
      prefUpdate.strokeColor = value;
    } else if (style.id === DefaultSizeStyle.id) {
      prefUpdate.textSize = value;
      prefUpdate.strokeSize = value;
    } else if (style.id === DefaultFontStyle.id) {
      prefUpdate.textFont = value;
    } else if (style.id === DefaultTextAlignStyle.id) {
      prefUpdate.textAlign = value;
    } else if (style.id === DefaultDashStyle.id) {
      prefUpdate.dashStyle = value;
    } else if (style.id === DefaultFillStyle.id) {
      prefUpdate.fillStyle = value;
    } else if (style.id === GeoShapeGeoStyle.id) {
      prefUpdate.lastUsedGeo = value;
    } else if (style.id === FillColorStyle.id) {
      prefUpdate.fillColor = value;
    } else if (style.id === FillOpacityStyle.id) {
      prefUpdate.fillOpacity = value;
    } else if (style.id === StrokeOpacityStyle.id) {
      prefUpdate.strokeOpacity = value;
    }
    userPrefs.updatePreferences(prefUpdate);
  };

  // 1. Draw/Shape Tools
  // 2. Text Tool
  // 3. Selection Tool IF we are editing Rich Text OR if we have selected shapes
  if (!isShapeTool && !isTextTool && !(isSelectTool && (isEditingRichText || hasSelectedShapes))) {
    return null;
  }

  // Reactive reads (tracked)
  const getStyle = (style: any, fallback: string) => {
    // 1. Check Editing Shape
    const editingShapeId = editor.getEditingShapeId();
    if (editingShapeId) {
      const shape = editor.getShape(editingShapeId);
      if (shape && (shape as any).props) {
        const propKey = style.id.replace('tldraw:', '');
        const finalKey = propKey === 'textAlign' ? 'align' : propKey;
        if ((shape as any).props[finalKey] !== undefined) {
          return (shape as any).props[finalKey];
        }
      }
    }

    // 2. Check first selected shape (Requirement: initial config is from the first in selection)
    const firstShape = selectedShapes[0];
    if (firstShape && (firstShape as any).props) {
      const propKey = style.id.replace('tldraw:', '');
      const finalKey = propKey === 'textAlign' ? 'align' : propKey;
      if ((firstShape as any).props[finalKey] !== undefined) {
        return (firstShape as any).props[finalKey];
      }
    }

    // 3. Fallback to shared styles (for editor context/future shapes)
    const sharedStyles = editor.getSharedStyles();
    const shared = sharedStyles.get(style);
    if (shared && shared.type === 'shared') {
      return shared.value;
    }
    // 4. Check next shape style (tool state)
    if ('getStyleForNextShape' in editor) {
      return (editor as any).getStyleForNextShape(style);
    }
    return fallback;
  };

  // Visibility flags based on state and selection
  // Visibility flags based on state and selection
  const isTextMode = isTextTool || isEditingRichText || (isSelectTool && isAllText);

  // Specific visibility for sections
  const showTextSection = isTextMode;
  const showShapeTypeSection = (activeTool === 'geo' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'shapes') || (isSelectTool && isAllShape);
  const showStrokeSection = (activeTool === 'draw' || showShapeTypeSection) || (isSelectTool && (isAllShape || isAllDraw));
  const showFillSection = showShapeTypeSection;

  // Hide bubble if mixed selection or nothing relevant
  if (isSelectTool && !isAllText && !isAllShape && !isAllDraw && !isAllImage && !isEditingRichText) {
    return null;
  }

  const currentSize = isTextMode ? richStats.size : ((getStyle(DefaultSizeStyle, 'm') as string) || richStats.size || 'm');
  const currentColor = isTextMode ? richStats.color : ((getStyle(DefaultColorStyle, 'black') as string) || richStats.color || 'black');
  const currentFont = isTextMode ? richStats.font : ((getStyle(DefaultFontStyle, 'draw') as string) || richStats.font || 'draw');

  const currentGeo = (getStyle(GeoShapeGeoStyle, 'rectangle') as string);
  const currentDash = (getStyle(DefaultDashStyle, 'solid') as string);
  const currentFill = (getStyle(DefaultFillStyle, 'none') as string);
  const currentTldrawTool = editor.getCurrentToolId();

  // Get current values for custom styles
  const currentFillColor = (getStyle(FillColorStyle, 'black') as string);
  const currentFillOpacity = parseFloat(getStyle(FillOpacityStyle, '1') as string);
  const currentStrokeOpacity = parseFloat(getStyle(StrokeOpacityStyle, '1') as string);

  const activeColorHex = colorsMap[currentColor] || theme.black.solid;

  const currentShapeOption = (() => {
    if (currentTldrawTool === 'arrow' || (isSelectTool && isAllShape && selectedShapes[0].type === 'arrow')) return 'arrow';
    if (currentTldrawTool === 'line' || (isSelectTool && isAllShape && selectedShapes[0].type === 'line')) return 'line';
    return currentGeo;
  })();


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
          {(activeTool === 'text' || isEditingRichText || (isSelectTool && isAllText)) ? (
            <div style={{
              fontFamily: (() => {
                const fonts: Record<string, string> = {
                  draw: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
                  sans: 'Inter, sans-serif',
                  serif: 'serif',
                  mono: 'monospace'
                };
                return fonts[currentFont] || fonts.sans;
              })(),
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
          ) : (activeTool === 'geo' || activeTool === 'arrow' || activeTool === 'line' || activeTool === 'shapes' || (isSelectTool && isAllShape)) ? (
            <Shapes size={24} />
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
        {showTextSection && (
          <div className={styles.textSettings}>
            <div className={styles.topRow}>
              <div className={styles.textToolsRow}>
                {['draw', 'sans', 'serif', 'mono'].map(f => (
                  <button
                    key={f}
                    className={clsx(styles.iconBtnTiny, currentFont === f && styles.active)}
                    style={{
                      fontFamily: `var(--font-${f})`,
                      fontSize: '16px',
                      fontWeight: 'bold',
                    }}
                    onClick={() => setStyle(DefaultFontStyle, f)}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    title={t(`font_${f}`)}
                  >
                    A
                  </button>
                ))}
                <div className={styles.verticalDivider} />
                {['xs', 's', 'm', 'l', 'xl', 'xxl'].map(s => (
                  <button
                    key={s}
                    className={clsx(styles.iconBtnTiny, currentSize === s && styles.active)}
                    style={{
                      fontSize: s === 'xs' ? '10px' :
                        s === 's' ? '12px' :
                          s === 'm' ? '14px' :
                            s === 'l' ? '18px' :
                              s === 'xl' ? '22px' : '26px',
                      fontWeight: 'bold',
                    }}
                    onClick={() => setStyle(DefaultSizeStyle, s)}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    title={t(`font_size_${s}`)}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.toolsRow}>
              <div className={styles.styleGroup}>
                <button
                  className={clsx(styles.iconBtn, richStats.bold && styles.active)}
                  onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('bold'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_bold')}
                >
                  <Bold strokeWidth={2.5} size={16} />
                </button>
                <button
                  className={clsx(styles.iconBtn, richStats.italic && styles.active)}
                  onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('italic'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_italic')}
                >
                  <Italic strokeWidth={2.5} size={16} />
                </button>
                <button
                  className={clsx(styles.iconBtn, richStats.underline && styles.active)}
                  onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('underline'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_underline')}
                >
                  <Underline strokeWidth={2.5} size={16} />
                </button>
                <button
                  className={clsx(styles.iconBtn, richStats.strike && styles.active)}
                  onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) toggleStyle('strikethrough'); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_strikethrough')}
                >
                  <Strikethrough strokeWidth={2.5} size={16} />
                </button>
                <div className={styles.verticalDivider} />
                <button
                  className={styles.iconBtn}
                  onClick={openLinkModal}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  title={t('format_link')}
                >
                  <LinkIcon size={16} />
                </button>
                <div className={styles.verticalDivider} />
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
            <div className={styles.colorsRow}>
              {colors.map(c => (
                <button
                  key={c}
                  className={clsx(styles.colorSwatch, richStats.color === c && styles.activeColor)}
                  style={{
                    backgroundColor: colorsMap[c],
                    boxShadow: richStats.color === c
                      ? `0 0 0 2px var(--glass-bg), 0 0 0 4px ${colorsMap[c]}`
                      : undefined
                  }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={() => !hasMoved.current && setStyle(DefaultColorStyle, c)}
                />
              ))}
            </div>
          </div>
        )}
        {showShapeTypeSection && (
          <div className={styles.shapeSettings}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>{t('tool_shapes')}</span>
            </div>
            {/* Shape Type Selection */}
            <div className={styles.styleGroup} style={{ justifyContent: 'space-between' }}>
              {['rectangle', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon'].map((shape) => {
                const isActive = currentShapeOption === shape;
                return (
                  <button
                    key={shape}
                    className={clsx(styles.iconBtn, isActive && styles.active)}
                    onClick={() => {
                      if (!hasMoved.current) {
                        editor.setCurrentTool('geo');
                        setStyle(GeoShapeGeoStyle, shape);
                      }
                    }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    title={t(`tool_${shape === 'rectangle' ? 'square' : shape === 'ellipse' ? 'circle' : shape}`)}
                  >
                    {shape === 'rectangle' && <Square size={16} />}
                    {shape === 'ellipse' && <Circle size={16} />}
                    {shape === 'triangle' && <Triangle size={16} />}
                    {shape === 'diamond' && <Diamond size={16} />}
                    {shape === 'pentagon' && <Pentagon size={16} />}
                    {shape === 'hexagon' && <Hexagon size={16} />}
                    {shape === 'octagon' && <Octagon size={16} />}
                  </button>
                );
              })}
            </div>
            <div className={styles.styleGroup} style={{ justifyContent: 'space-between' }}>
              {['star', 'cloud', 'heart', 'oval', 'trapezoid', 'rhombus', 'x-box'].map((shape) => {
                const isActive = currentShapeOption === shape;
                return (
                  <button
                    key={shape}
                    className={clsx(styles.iconBtn, isActive && styles.active)}
                    onClick={() => {
                      if (!hasMoved.current) {
                        editor.setCurrentTool('geo');
                        setStyle(GeoShapeGeoStyle, shape);
                      }
                    }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    title={t(`tool_${shape === 'x-box' ? 'star' : shape}`)}
                  >
                    {shape === 'star' && <Star size={16} />}
                    {shape === 'cloud' && <Cloud size={16} />}
                    {shape === 'heart' && <Heart size={16} />}
                    {shape === 'oval' && <Circle size={16} />}
                    {shape === 'trapezoid' && <TrapezoidIcon size={16} />}
                    {shape === 'rhombus' && <Diamond size={16} />}
                    {shape === 'x-box' && <X size={16} />}
                  </button>
                );
              })}
            </div>
            <div className={styles.styleGroup} style={{ justifyContent: 'space-between' }}>
              {['check-box', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow', 'line'].map((shape) => {
                const isActive = currentShapeOption === shape;
                return (
                  <button
                    key={shape}
                    className={clsx(styles.iconBtn, isActive && styles.active)}
                    onClick={() => {
                      if (!hasMoved.current) {
                        if (shape === 'arrow' || shape === 'line') {
                          editor.setCurrentTool(shape);
                        } else {
                          editor.setCurrentTool('geo');
                          setStyle(GeoShapeGeoStyle, shape);
                        }
                      }
                    }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    title={t(`tool_${shape}`)}
                  >
                    {shape === 'check-box' && <Check size={16} />}
                    {shape === 'arrow-up' && <ArrowBigUp size={16} />}
                    {shape === 'arrow-down' && <ArrowBigDown size={16} />}
                    {shape === 'arrow-left' && <ArrowBigLeft size={16} />}
                    {shape === 'arrow-right' && <ArrowBigRight size={16} />}
                    {shape === 'arrow' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    )}
                    {shape === 'line' && <Minus size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STROKE SECTION */}
        {showStrokeSection && (
          <div className={styles.strokeSettings}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>{t('style_stroke')}</span>
              <button
                className={clsx(styles.switch, currentStrokeOpacity > 0 && styles.switchActive)}
                onClick={() => {
                  const newOpacity = currentStrokeOpacity > 0 ? '0' : '1';
                  // Safety: Don't allow both off. If turning off stroke, turn on fill.
                  if (newOpacity === '0' && currentFill === 'none') {
                    setStyle(DefaultFillStyle, 'solid');
                    if (currentFillOpacity === 0) setStyle(FillOpacityStyle, '1');
                  }
                  setStyle(StrokeOpacityStyle, newOpacity);
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div className={styles.switchHandle} />
              </button>
            </div>

            {currentStrokeOpacity > 0 && (
              <>
                <div className={styles.sizeRow}>
                  {/* Dash Style */}
                  <div className={styles.styleGroup}>
                    {['draw', 'solid', 'dashed', 'dotted'].map((dash) => {
                      const isActive = currentDash === dash;
                      return (
                        <button
                          key={dash}
                          className={clsx(styles.iconBtnCompact, isActive && styles.active)}
                          onClick={() => {
                            if (!hasMoved.current) {
                              setStyle(DefaultDashStyle, dash);
                            }
                          }}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          title={t(`style_border_${dash}`)}
                        >
                          {dash === 'draw' ? (
                            <Scribble strokeWidth={2} />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                              {dash === 'solid' && <line x1="2" y1="10" x2="18" y2="10" />}
                              {dash === 'dashed' && <line x1="2" y1="10" x2="18" y2="10" strokeDasharray="4 2" />}
                              {dash === 'dotted' && <line x1="2" y1="10" x2="18" y2="10" strokeDasharray="1 2" />}
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {showStrokeSection && (
                    <>
                      <div className={styles.verticalDivider} />
                      <div className={styles.styleGroup} style={{ flex: 1, justifyContent: 'space-between' }}>
                        {((activeTool === 'draw' || (isSelectTool && selectedShapes.every(s => s.type === 'draw'))) ? ['xs', 's', 'm', 'l', 'xl', 'xxl'] : ['s', 'm', 'l', 'xl']).map((sz) => {
                          const strokeWidths: Record<string, number> = { xs: 1, s: 1.5, m: 2.5, l: 4, xl: 6, xxl: 10 };
                          return (
                            <button
                              key={sz}
                              className={clsx(styles.sizeBtnCompact, currentSize === sz && styles.active)}
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onClick={() => !hasMoved.current && setStyle(DefaultSizeStyle, sz)}
                            >
                              <Scribble strokeWidth={strokeWidths[sz]} />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

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

                <div className={styles.opacityRow}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentStrokeOpacity * 100}
                    onChange={(e) => {
                      const newOpacity = (parseInt(e.target.value) / 100).toString();
                      // Safety: if moving to 0 and fill is off, turn fill on
                      if (newOpacity === '0' && currentFill === 'none') {
                        setStyle(DefaultFillStyle, 'solid');
                        if (currentFillOpacity === 0) setStyle(FillOpacityStyle, '1');
                      }
                      setStyle(StrokeOpacityStyle, newOpacity);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={styles.opacitySlider}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* FILL Section */}
        {showFillSection && (
          <div className={styles.fillSettings}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>{t('style_fill')}</span>
              <button
                className={clsx(styles.switch, currentFill !== 'none' && styles.switchActive)}
                onClick={() => {
                  if (currentFill === 'none') {
                    setStyle(DefaultFillStyle, 'solid');
                    // Reset opacity if it was 0
                    if (currentFillOpacity === 0) setStyle(FillOpacityStyle, '1');
                  } else {
                    // Safety: if turning off fill, make sure stroke is on
                    if (currentStrokeOpacity === 0) {
                      setStyle(StrokeOpacityStyle, '1');
                    }
                    setStyle(DefaultFillStyle, 'none');
                  }
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div className={styles.switchHandle} />
              </button>
            </div>

            {currentFill !== 'none' && (
              <>
                <div className={styles.colorsRow}>
                  {colors.map(c => (
                    <button
                      key={c}
                      className={clsx(styles.colorSwatch, currentFillColor === c && styles.activeColor)}
                      style={{
                        backgroundColor: colorsMap[c],
                        boxShadow: currentFillColor === c
                          ? `0 0 0 2px var(--glass-bg), 0 0 0 4px ${colorsMap[c]}`
                          : undefined
                      }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={() => !hasMoved.current && setStyle(FillColorStyle, c)}
                    />
                  ))}
                </div>

                <div className={styles.opacityRow}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentFillOpacity * 100}
                    onChange={(e) => {
                      const newOpacity = (parseInt(e.target.value) / 100).toString();
                      // Safety: if moving to 0 and stroke is off, turn stroke on
                      if (newOpacity === '0' && currentStrokeOpacity === 0) {
                        setStyle(StrokeOpacityStyle, '1');
                      }
                      setStyle(FillOpacityStyle, newOpacity);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={styles.opacitySlider}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {isLinkModalOpen && (
          <LinkInputModal
            onConfirm={handleLinkConfirm}
            onCancel={() => setIsLinkModalOpen(false)}
            title={t('format_link')}
          />
        )}
      </div>
    </UIPortal >
  );
});
