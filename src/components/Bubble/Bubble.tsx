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
} from './sections';

interface BubbleProps {
  activeTool: string;
}

export const Bubble = track(({ activeTool }: BubbleProps) => {
  const { t } = useTranslation();
  const editor = useEditor();
  const isDarkMode = useIsDarkMode();
  const theme = getDefaultColorTheme({ isDarkMode });
  const [isCollapsed, setIsCollapsed] = useState(false);
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

        document.execCommand('fontName', false, fontFamilies[userPrefs.textFont] || 'sans-serif');
        document.execCommand('fontSize', false, fontSizes[userPrefs.textSize] || '4');

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
      requestAnimationFrame(() => updateStats());
      document.addEventListener('pointerup', updateStats);
      document.addEventListener('keyup', updateStats);
    }

    return () => {
      document.removeEventListener('pointerup', updateStats);
      document.removeEventListener('keyup', updateStats);
    };
  }, [editor, t, colorsMap, userPrefs]);

  // Proactive sync when switching to text tool
  useEffect(() => {
    if (activeTool === 'text') {
      editor.setStyleForNextShapes(DefaultColorStyle, richStats.color);
      editor.setStyleForNextShapes(DefaultSizeStyle, richStats.size);
      editor.setStyleForNextShapes(DefaultFontStyle, richStats.font);
      const validAlign = richStats.align === 'justify' ? 'start' : richStats.align;
      editor.setStyleForNextShapes(DefaultTextAlignStyle, validAlign);
    }
  }, [activeTool, editor, richStats.color, richStats.size, richStats.font, richStats.align]);

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
        const storeKey = `text${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof userPrefs;
        userPrefs.updatePreferences({ [storeKey]: next[key as keyof typeof next] });
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
        const storeKey = `text${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof userPrefs;
        userPrefs.updatePreferences({ [storeKey]: next[key as keyof typeof next] });
        return next;
      });
    }
  };

  // Dimensions
  const width = isCollapsed ? 48 : 340;
  const height = isCollapsed ? 48 : (activeTool === 'text' ? 240 : (activeTool === 'shapes' ? 300 : 170));

  const { dominantHand } = useFileSystemStore();
  const leftHandedMode = dominantHand === 'left';
  const initialX = leftHandedMode ? 100 : window.innerWidth / 2 - 170;
  const { position, setPosition, handlePointerDown, hasMoved, isDragging } = useDraggableWithBounds({ x: initialX, y: 100 }, width, height);

  // Smart double click handler
  const lastClickTime = useRef(0);
  const handleSmartClick = (e: React.MouseEvent) => {
    if (hasMoved.current) return;
    const now = Date.now();
    if (now - lastClickTime.current < 300) {
      setRelativeClickPoint({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      const newX = e.clientX - 24;
      const newY = e.clientY - 24;
      setPosition({ x: newX, y: newY });
      setIsCollapsed(true);
    }
    lastClickTime.current = now;
  };

  const handleExpandCheck = () => {
    if (!hasMoved.current) {
      const newX = (position.x + 24) - relativeClickPoint.x;
      const newY = (position.y + 24) - relativeClickPoint.y;
      setPosition({ x: newX, y: newY });
      setIsCollapsed(false);
    }
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
          userPrefs.updatePreferences({ textColor: value });
        }

        if (style.id === 'tldraw:font') {
          document.execCommand('fontName', false, fontFamilies[value] || 'sans-serif');
          setRichStats(prev => ({ ...prev, font: value }));
          editor.setStyleForNextShapes(DefaultFontStyle, value);
          userPrefs.updatePreferences({ textFont: value });
        }

        if (style.id === 'tldraw:size') {
          document.execCommand('fontSize', false, fontSizes[value] || '5');
          setRichStats(prev => ({ ...prev, size: value }));
          editor.setStyleForNextShapes(DefaultSizeStyle, value);
          userPrefs.updatePreferences({ textSize: value });
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

  // Early returns for visibility
  if (!isShapeTool && !isTextTool && !(isSelectTool && (isEditingRichText || hasSelectedShapes))) {
    return null;
  }

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

  // Visibility flags
  const isTextMode = isTextTool || isEditingRichText || (isSelectTool && isAllText);
  const showTextSection = isTextMode;
  const showShapeTypeSection = (activeTool === 'geo' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'shapes') || (isSelectTool && isAllShape);
  const showStrokeSection = (activeTool === 'draw' || showShapeTypeSection) || (isSelectTool && (isAllShape || isAllDraw));
  const showFillSection = showShapeTypeSection;

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
        <BubbleCollapsed
          activeTool={activeTool}
          isEditingRichText={isEditingRichText}
          isSelectTool={isSelectTool}
          isAllText={isAllText}
          isAllShape={isAllShape}
          currentFont={currentFont}
          currentSize={currentSize}
          activeColorHex={activeColorHex}
          richStats={richStats}
          isDragging={isDragging}
          position={position}
          handlePointerDown={handlePointerDown}
          handleExpandCheck={handleExpandCheck}
        />
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
    </UIPortal>
  );
});
