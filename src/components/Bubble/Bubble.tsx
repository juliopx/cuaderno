import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';

import { LinkInputModal } from '../UI/LinkInputModal';
import {
  FillColorStyle,
  FillOpacityStyle,
  StrokeOpacityStyle,
} from '../../styles/customStyles';

// Extracted modules
import { useDraggableWithBounds } from '../../hooks/useDraggableWithBounds';
import { applyStyleToRichText, fontFamilies, fontSizes } from './utils';
import {
  BubbleCollapsed,
  BubbleTextSection,
  BubbleShapeSection,
  BubbleStrokeSection,
  BubbleFillSection,
  BubbleToolbarSection,
} from './sections';

interface BubbleProps {
  activeTool: string;
  onSelectTool: (tool: string) => void;
  onUpload?: (files: File[]) => void;
  onAddUrl?: (url: string) => void;
}

export const Bubble = track(({ activeTool, onSelectTool, onUpload, onAddUrl }: BubbleProps) => {
  const { t } = useTranslation();
  const editor = useEditor();
  const isDarkMode = useIsDarkMode();
  const theme = getDefaultColorTheme({ isDarkMode });
  // const [isCollapsed, setIsCollapsed] = useState(false); // Removed in favor of store
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

      setTimeout(() => {
        const selection = window.getSelection();
        if (savedRange.current && selection) {
          selection.removeAllRanges();
          selection.addRange(savedRange.current);
        }

        const currentSelection = window.getSelection();
        if (currentSelection && currentSelection.isCollapsed) {
          document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`);
        } else {
          document.execCommand('createLink', false, url);
        }
        setIsLinkModalOpen(false);
        savedRange.current = null;
      }, 50);
    } else {
      setIsLinkModalOpen(false);
    }
  };

  const {
    textColor, textSize, textFont, textAlign, textBold, textItalic, textUnderline, textStrike,
    drawColor, drawSize, drawOpacity, drawDash,
    shapeColor, shapeSize, shapeOpacity, shapeDash, shapeFill, shapeFillColor, shapeFillOpacity,
    lastActiveTool,
    bubbleCollapsed,
    bubblePosition,
    updatePreferences
  } = useUserPreferencesStore();



  const editingId = editor.getEditingShapeId();
  const editingShape = editingId ? editor.getShape(editingId) : null;
  const isEditingRichText = editingShape?.type === 'rich-text';

  const selectedShapes = editor.getSelectedShapes();
  const isSelectTool = activeTool === 'select';
  const isTextTool = activeTool === 'text';

  const TEXT_TYPES = ['text', 'rich-text'];
  const SHAPE_TYPES = ['geo', 'arrow', 'line'];
  const DRAW_TYPES = ['draw'];

  const allSelectedMatch = (types: string[]) =>
    selectedShapes.length > 0 && selectedShapes.every(s => types.includes(s.type));

  const isAllText = allSelectedMatch(TEXT_TYPES);
  const isAllShape = allSelectedMatch(SHAPE_TYPES);
  const isAllDraw = allSelectedMatch(DRAW_TYPES);

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
    bold: textBold,
    italic: textItalic,
    underline: textUnderline,
    strike: textStrike,
    font: textFont,
    size: textSize,
    color: textColor,
    align: textAlign
  });

  // Sync state with cursor position
  useEffect(() => {
    const editingId = editor.getEditingShapeId();
    const editingShape = editingId ? editor.getShape(editingId) : null;
    const isRichText = editingShape?.type === 'rich-text';

    if (!isRichText) return;

    const updateStats = (e?: Event) => {
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

        updatePreferences({
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

    const html = (editingShape?.props as any)?.html || '';
    const isNewNode = html === '' || html === '<div></div>' || html === `<div>${t('start_typing')}</div>` || html === t('start_typing');

    const applyPersistentStyles = () => {
      const active = document.activeElement as HTMLElement;
      if (active?.getAttribute('contenteditable') === 'true') {
        if (textBold) document.execCommand('bold');
        if (textItalic) document.execCommand('italic');
        if (textUnderline) document.execCommand('underline');
        if (textStrike) document.execCommand('strikethrough');

        const hex = colorsMap[textColor] || '#000000';
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, hex);

        document.execCommand('fontName', false, fontFamilies[textFont] || 'sans-serif');
        document.execCommand('fontSize', false, fontSizes[textSize] || '4');

        setRichStats({
          bold: textBold,
          italic: textItalic,
          underline: textUnderline,
          strike: textStrike,
          font: textFont,
          size: textSize,
          color: textColor,
          align: textAlign
        });
      } else {
        requestAnimationFrame(applyPersistentStyles);
      }
    };

    if (isNewNode) {
      requestAnimationFrame(applyPersistentStyles);
    } else {
      requestAnimationFrame(() => updateStats());
      document.addEventListener('pointerup', updateStats);
      document.addEventListener('keyup', updateStats);
    }

    return () => {
      document.removeEventListener('pointerup', updateStats);
      document.removeEventListener('keyup', updateStats);
    };
  }, [editor, t, colorsMap, textBold, textItalic, textUnderline, textStrike, textColor, textFont, textSize, textAlign, updatePreferences]);

  // Track last active tool (excluding eraser)
  useEffect(() => {
    if (activeTool !== 'eraser' && activeTool !== lastActiveTool) {
      updatePreferences({ lastActiveTool: activeTool });
    }
  }, [activeTool, lastActiveTool, updatePreferences]);

  // Proactive sync when switching tools
  useEffect(() => {
    if (activeTool === 'text') {
      editor.setStyleForNextShapes(DefaultColorStyle, richStats.color);
      editor.setStyleForNextShapes(DefaultSizeStyle, richStats.size);
      editor.setStyleForNextShapes(DefaultFontStyle, richStats.font);
      const validAlign = richStats.align === 'justify' ? 'start' : richStats.align;
      editor.setStyleForNextShapes(DefaultTextAlignStyle, validAlign);
    } else if (activeTool === 'draw') {
      editor.setStyleForNextShapes(DefaultColorStyle, drawColor);
      editor.setStyleForNextShapes(DefaultSizeStyle, drawSize);
      editor.setStyleForNextShapes(DefaultDashStyle, drawDash as any);
      editor.setStyleForNextShapes(StrokeOpacityStyle, drawOpacity);
    } else if (['geo', 'arrow', 'line', 'shapes'].includes(activeTool)) {
      editor.setStyleForNextShapes(DefaultColorStyle, shapeColor);
      editor.setStyleForNextShapes(DefaultSizeStyle, shapeSize);
      editor.setStyleForNextShapes(DefaultDashStyle, shapeDash as any);
      editor.setStyleForNextShapes(StrokeOpacityStyle, shapeOpacity);
      editor.setStyleForNextShapes(DefaultFillStyle, shapeFill as any);
      editor.setStyleForNextShapes(FillColorStyle, shapeFillColor);
      editor.setStyleForNextShapes(FillOpacityStyle, shapeFillOpacity);
    }
  }, [activeTool, editor, richStats.color, richStats.size, richStats.font, richStats.align, drawColor, drawSize, drawDash, drawOpacity, shapeColor, shapeSize, shapeDash, shapeOpacity, shapeFill, shapeFillColor, shapeFillOpacity]);

  // Sync from selection
  useEffect(() => {
    if (isSelectTool && isAllText && selectedShapes[0]) {
      const first = selectedShapes[0] as any;
      const html = first.props.html || '';
      const hasStrike = html.includes('line-through') || html.includes('<s>') || html.includes('<strike>') || html.includes('<del>');
      const hasUnderline = html.includes('underline') || html.includes('<u>');

      setRichStats({
        bold: first.props.bold || false,
        italic: first.props.italic || false,
        underline: first.props.underline || hasUnderline,
        strike: first.props.strike || hasStrike,
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
      const active = document.activeElement;
      if (!active?.classList.contains('rich-text-container') && !active?.closest('.rich-text-container')) {
        const shapeEl = document.getElementById(editingShape.id)?.querySelector('.rich-text-container');
        if (shapeEl) {
          (shapeEl as HTMLElement).focus();
        }
      }

      document.execCommand(command);

      const isNewNode = (editingShape.props as any).html === '' || (editingShape.props as any).html === '<div></div>';
      if (isNewNode) {
        const currentVal = (editingShape.props as any)[key];
        editor.updateShape({
          id: editingShape.id,
          type: 'rich-text',
          props: { [key]: !currentVal }
        });
      }

      setRichStats(prev => {
        const next = { ...prev, [key]: !prev[key as keyof typeof prev] };
        const storeKey = `text${key.charAt(0).toUpperCase() + key.slice(1)}`;
        updatePreferences({ [storeKey]: next[key as keyof typeof next] });
        return next;
      });
    } else {
      if (selectedShapes.length > 0) {
        const textUpdates = selectedShapes
          .filter(s => s.type === 'rich-text')
          .map(s => {
            const propValue = (s.props as any)[key];
            let isActive = propValue;

            if (key === 'strike') {
              const html = (s.props as any).html || '';
              isActive = propValue || html.includes('line-through') || html.includes('<s>') || html.includes('<strike>') || html.includes('<del>');
            } else if (key === 'underline') {
              const html = (s.props as any).html || '';
              isActive = propValue || html.includes('underline') || html.includes('<u>');
            }

            const newValue = !isActive;
            const newPropValue = (key === 'strike' || key === 'underline') ? false : newValue;

            return {
              id: s.id,
              type: 'rich-text',
              props: {
                [key]: newPropValue,
                html: applyStyleToRichText((s.props as any).html, key, newValue)
              }
            };
          });

        if (textUpdates.length > 0) {
          editor.updateShapes(textUpdates as any);
        }
      }

      setRichStats(prev => {
        const next = { ...prev, [key]: !prev[key as keyof typeof prev] };
        const storeKey = `text${key.charAt(0).toUpperCase() + key.slice(1)}`;
        updatePreferences({ [storeKey]: next[key as keyof typeof next] });
        return next;
      });
    }
  };

  const { dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';

  // Visibility flags
  const isTextMode = isTextTool || isEditingRichText || (isSelectTool && isAllText);
  const showTextSection = isTextMode;
  const showShapeTypeSection = (activeTool === 'geo' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'shapes') || (isSelectTool && isAllShape);
  const showStrokeSection = (activeTool === 'draw' || showShapeTypeSection) || (isSelectTool && (isAllShape || isAllDraw));
  const showFillSection = showShapeTypeSection;

  // Dimensions
  const width = bubbleCollapsed ? 48 : 340;

  // Use a callback ref to ensure we observe as soon as the element mounts
  const [dynamicHeight, setDynamicHeight] = useState(bubbleCollapsed ? 48 : 100);
  const observerRef = useRef<ResizeObserver | null>(null);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      // Initial measure
      setDynamicHeight(node.offsetHeight);

      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.borderBoxSize) {
            const borderBoxSize = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
            setDynamicHeight(borderBoxSize.blockSize);
          } else {
            setDynamicHeight(entry.contentRect.height);
          }
        }
      });
      observerRef.current.observe(node);
    }
  }, []); // Stable callback

  // Use dynamic height for boundaries, with a safe fallback
  const boundaryHeight = dynamicHeight || (bubbleCollapsed ? 48 : 200);

  const defaultX = leftHandedMode ? 100 : window.innerWidth / 2 - (width / 2);
  const defaultY = window.innerHeight - boundaryHeight - 32;

  const initialX = bubblePosition ? bubblePosition.x : defaultX;
  const initialY = bubblePosition ? bubblePosition.y : defaultY;

  const { position, setPosition, handlePointerDown, hasMoved, isDragging } = useDraggableWithBounds(
    { x: initialX, y: initialY },
    width,
    boundaryHeight,
    (pos) => updatePreferences({ bubblePosition: pos })
  );

  // Sync position with store updates (handles hydration and external changes)
  useEffect(() => {
    if (bubblePosition && !isDragging) {
      const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

      const clampedX = clamp(bubblePosition.x, 0, window.innerWidth - width);
      // Use boundaryHeight instead of dynamicHeight directly to be safe, or recalculate if needed.
      // Since boundaryHeight tracks dynamicHeight, it's correct.
      const clampedY = clamp(bubblePosition.y, 0, window.innerHeight - boundaryHeight);

      const dx = Math.abs(clampedX - position.x);
      const dy = Math.abs(clampedY - position.y);

      // Update if significant difference OR if claming changed the store value
      if (dx > 1 || dy > 1) {
        setPosition({ x: clampedX, y: clampedY });

        // Optional: Update store if it was out of bounds?
        // Better to just keep local state valid.
      }
    }
  }, [bubblePosition, position, setPosition, isDragging, width, boundaryHeight]);

  // Smart double click handler for collapsing
  const lastClickTime = useRef(0);

  const handleCollapse = (e: React.MouseEvent) => {
    setRelativeClickPoint({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    const newX = e.clientX - 24;
    const newY = e.clientY - 24;
    setPosition({ x: newX, y: newY });
    updatePreferences({ bubbleCollapsed: true, bubblePosition: { x: newX, y: newY } });
  };

  const handleSmartClick = (e: React.MouseEvent) => {
    if (hasMoved.current) return;
    const now = Date.now();
    // Logic for double-click ONLY to collapse
    if (now - lastClickTime.current < 200) {
      handleCollapse(e);
    }
    lastClickTime.current = now;
  };

  const handleExpand = () => {
    const newX = (position.x + 24) - (relativeClickPoint.x || 24);
    const newY = (position.y + 24) - (relativeClickPoint.y || 24);
    setPosition({ x: newX, y: newY });
    updatePreferences({ bubbleCollapsed: false, bubblePosition: { x: newX, y: newY } });
  };

  const colors = Object.keys(colorsMap);

  // Helper to set style
  const setStyle = (style: any, value: any) => {
    const editingShapeId = editor.getEditingShapeId();
    if (editingShapeId) {
      const shape = editor.getShape(editingShapeId);

      if (shape && shape.type === 'rich-text') {
        if (style.id === 'tldraw:color') {
          const hex = colorsMap[value] || '#000000';
          const active = document.activeElement;
          if (!active?.classList.contains('rich-text-container')) {
            const shapeEl = document.getElementById(editingShapeId)?.querySelector('.rich-text-container');
            if (shapeEl) (shapeEl as HTMLElement).focus();
          }

          document.execCommand('styleWithCSS', false, 'true');
          document.execCommand('foreColor', false, hex);
          setRichStats(prev => ({ ...prev, color: value }));
          editor.setStyleForNextShapes(DefaultColorStyle, value);
          updatePreferences({ textColor: value });
        }

        if (style.id === 'tldraw:font') {
          document.execCommand('fontName', false, fontFamilies[value] || 'sans-serif');
          setRichStats(prev => ({ ...prev, font: value }));
          editor.setStyleForNextShapes(DefaultFontStyle, value);
          updatePreferences({ textFont: value });
        }

        if (style.id === 'tldraw:size') {
          document.execCommand('fontSize', false, fontSizes[value] || '5');
          setRichStats(prev => ({ ...prev, size: value }));
          editor.setStyleForNextShapes(DefaultSizeStyle, value);
          updatePreferences({ textSize: value });
        }

        if (style.id === 'tldraw:textAlign') {
          setRichStats(prev => ({ ...prev, align: value }));
        }
      }

      const propKey = style.id.replace('tldraw:', '');
      const finalPropKey = propKey === 'textAlign' ? 'align' : propKey;
      const isAlignment = finalPropKey === 'align';
      const isNewNode = shape && ((shape.props as any).html === '' || (shape.props as any).html === '<div></div>');

      if (shape && (isAlignment || isNewNode)) {
        editor.updateShape({
          id: editingShapeId,
          type: shape.type,
          props: { [finalPropKey]: value }
        } as any);
      } else {
        if ('setStyleForNextShapes' in editor) {
          editor.setStyleForNextShapes(style, value);
        }
      }
      return;
    }

    if (editor.getSelectedShapes().length > 0) {
      const selected = editor.getSelectedShapes();
      const propKey = style.id.replace('tldraw:', '');
      const finalPropKey = propKey === 'textAlign' ? 'align' : propKey;

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

      if (style.id === 'tldraw:textAlign' && value === 'justify') {
        // Already handled in textUpdates
      } else {
        editor.setStyleForSelectedShapes(style, value);
      }
    }

    if ('setStyleForNextShapes' in editor) {
      if (style.id === 'tldraw:textAlign' && value === 'justify') {
        (editor as any).setStyleForNextShapes(style, 'start');
      } else {
        (editor as any).setStyleForNextShapes(style, value);
      }
    }

    const propKey = style.id.replace('tldraw:', '');
    const finalPropKey = propKey === 'textAlign' ? 'align' : propKey;
    setRichStats(prev => ({ ...prev, [finalPropKey]: value }));

    const prefUpdate: any = {};

    // Determine which tool's preferences to update
    const selected = editor.getSelectedShapes();
    const firstSelected = selected[0];
    const editingId = editor.getEditingShapeId();
    const editingShape = editingId ? editor.getShape(editingId) : null;

    const targetIsText = isTextMode || (editingShape?.type === 'rich-text') || (firstSelected?.type === 'rich-text');
    const targetIsDraw = (activeTool === 'draw' && !targetIsText) || (firstSelected?.type === 'draw');
    const targetIsShape = (['geo', 'shapes', 'arrow', 'line'].includes(activeTool) && !targetIsText) || (['geo', 'arrow', 'line'].includes(firstSelected?.type as any));

    if (style.id === DefaultColorStyle.id) {
      if (targetIsText) prefUpdate.textColor = value;
      if (targetIsDraw) prefUpdate.drawColor = value;
      if (targetIsShape) prefUpdate.shapeColor = value;
    } else if (style.id === DefaultSizeStyle.id) {
      if (targetIsText) prefUpdate.textSize = value;
      if (targetIsDraw) prefUpdate.drawSize = value;
      if (targetIsShape) prefUpdate.shapeSize = value;
    } else if (style.id === DefaultFontStyle.id) {
      prefUpdate.textFont = value;
    } else if (style.id === DefaultTextAlignStyle.id) {
      prefUpdate.textAlign = value;
    } else if (style.id === DefaultDashStyle.id) {
      if (targetIsDraw) prefUpdate.drawDash = value;
      if (targetIsShape) prefUpdate.shapeDash = value;
    } else if (style.id === DefaultFillStyle.id) {
      prefUpdate.shapeFill = value;
    } else if (style.id === GeoShapeGeoStyle.id) {
      prefUpdate.lastUsedGeo = value;
    } else if (style.id === FillColorStyle.id) {
      prefUpdate.shapeFillColor = value;
    } else if (style.id === FillOpacityStyle.id) {
      prefUpdate.shapeFillOpacity = value;
    } else if (style.id === StrokeOpacityStyle.id) {
      if (targetIsDraw) prefUpdate.drawOpacity = value;
      if (targetIsShape) prefUpdate.shapeOpacity = value;
    }
    updatePreferences(prefUpdate);
  };

  // Early returns for visibility (Bubble is now always visible unless collapsed logic handled below)
  // No early return here anymore as it contains the toolbar


  // Reactive reads
  const getStyle = (style: any, fallback: string) => {
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

    const firstShape = selectedShapes[0];
    if (firstShape && (firstShape as any).props) {
      const propKey = style.id.replace('tldraw:', '');
      const finalKey = propKey === 'textAlign' ? 'align' : propKey;
      if ((firstShape as any).props[finalKey] !== undefined) {
        return (firstShape as any).props[finalKey];
      }
    }

    const sharedStyles = editor.getSharedStyles();
    const shared = sharedStyles.get(style);
    if (shared && shared.type === 'shared') {
      return shared.value;
    }
    if ('getStyleForNextShape' in editor) {
      return (editor as any).getStyleForNextShape(style);
    }
    return fallback;
  };

  // No early return here anymore as it contains the toolbar


  const currentSize = isTextMode ? richStats.size : ((getStyle(DefaultSizeStyle, 'm') as string) || richStats.size || 'm');
  const currentColor = isTextMode ? richStats.color : ((getStyle(DefaultColorStyle, 'black') as string) || richStats.color || 'black');
  const currentFont = isTextMode ? richStats.font : ((getStyle(DefaultFontStyle, 'draw') as string) || richStats.font || 'draw');

  const currentGeo = (getStyle(GeoShapeGeoStyle, 'rectangle') as string);
  const currentDash = (getStyle(DefaultDashStyle, 'solid') as string);
  const currentFill = (getStyle(DefaultFillStyle, 'none') as string);
  const currentTldrawTool = editor.getCurrentToolId();

  const currentFillColor = (getStyle(FillColorStyle, 'black') as string);
  const currentFillOpacity = parseFloat(getStyle(FillOpacityStyle, '1') as string);
  const currentStrokeOpacity = parseFloat(getStyle(StrokeOpacityStyle, '1') as string);

  const activeColorHex = colorsMap[currentColor] || theme.black.solid;

  const currentShapeOption = (() => {
    if (currentTldrawTool === 'arrow' || (isSelectTool && isAllShape && selectedShapes[0].type === 'arrow')) return 'arrow';
    if (currentTldrawTool === 'line' || (isSelectTool && isAllShape && selectedShapes[0].type === 'line')) return 'line';
    return currentGeo;
  })();

  if (bubbleCollapsed) {
    return (
      <UIPortal>
        <BubbleCollapsed
          activeTool={activeTool}
          onSelectTool={onSelectTool}
          lastActiveTool={lastActiveTool}
          isEditingRichText={isEditingRichText}
          isSelectTool={isSelectTool}
          isAllText={isAllText}
          isAllShape={isAllShape}
          currentFont={currentFont}
          currentSize={currentSize}
          activeColorHex={activeColorHex}
          richStats={richStats}
          isDragging={isDragging}
          hasMoved={hasMoved}
          position={position}
          handlePointerDown={handlePointerDown}
          handleExpand={handleExpand}
        />
      </UIPortal>
    );
  }

  return (

    <UIPortal>
      <div
        ref={measureRef}
        className={clsx(styles.bubble, isDragging && styles.dragging)}
        style={{
          left: position.x,
          top: position.y,
          pointerEvents: 'auto',
          position: 'fixed',
          zIndex: 1000,
          width
        }}
        onPointerDown={handlePointerDown}
        onClick={handleSmartClick}
        data-is-ui="true"
      >
        <BubbleToolbarSection
          activeTool={activeTool}
          onSelectTool={onSelectTool}
          onUpload={onUpload}
          onAddUrl={onAddUrl}
          hasMoved={hasMoved}
          onCollapse={handleCollapse}
        />

        {(showTextSection || showShapeTypeSection || showStrokeSection || showFillSection) && (
          <div className={styles.divider} />
        )}

        {showTextSection && (
          <BubbleTextSection
            richStats={richStats}
            currentFont={currentFont}
            currentSize={currentSize}
            colorsMap={colorsMap}
            colors={colors}
            isEditingRichText={isEditingRichText}
            editingShape={editingShape}
            hasMoved={hasMoved}
            setStyle={setStyle}
            toggleStyle={toggleStyle}
            getStyle={getStyle}
            openLinkModal={openLinkModal}
          />
        )}

        {showShapeTypeSection && (
          <BubbleShapeSection
            currentShapeOption={currentShapeOption}
            hasMoved={hasMoved}
            editor={editor}
            setStyle={setStyle}
          />
        )}

        {showStrokeSection && (
          <BubbleStrokeSection
            activeTool={activeTool}
            isSelectTool={isSelectTool}
            isAllDraw={isAllDraw}
            currentDash={currentDash}
            currentSize={currentSize}
            currentColor={currentColor}
            currentStrokeOpacity={currentStrokeOpacity}
            currentFill={currentFill}
            currentFillOpacity={currentFillOpacity}
            colorsMap={colorsMap}
            colors={colors}
            hasMoved={hasMoved}
            setStyle={setStyle}
          />
        )}

        {showFillSection && (
          <BubbleFillSection
            currentFill={currentFill}
            currentFillColor={currentFillColor}
            currentFillOpacity={currentFillOpacity}
            currentStrokeOpacity={currentStrokeOpacity}
            colorsMap={colorsMap}
            colors={colors}
            hasMoved={hasMoved}
            setStyle={setStyle}
          />
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
