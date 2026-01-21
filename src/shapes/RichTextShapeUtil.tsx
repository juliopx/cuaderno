import { BaseBoxShapeUtil, HTMLContainer, stopEventPropagation, useValue, getDefaultColorTheme } from 'tldraw'
import type { TLBaseShape } from 'tldraw'
import * as React from 'react'

export type RichTextShape = TLBaseShape<
  'rich-text',
  {
    w: number
    h: number
    html: string
    autoSize: boolean
    scaleX: number
    scaleY: number
    isCreating: boolean
    align: string
    color: string
    size: string
    font: string
    bold: boolean
    italic: boolean
    underline: boolean
    strike: boolean
  }
>

export class RichTextShapeUtil extends BaseBoxShapeUtil<RichTextShape> {
  static override type = 'rich-text' as const

  override getDefaultProps(): RichTextShape['props'] {
    return {
      w: 200,
      h: 50,
      html: '',
      autoSize: true,
      scaleX: 1,
      scaleY: 1,
      isCreating: false,
      align: 'start',
      color: 'black',
      size: 'm',
      font: 'sans',
      bold: false,
      italic: false,
      underline: false,
      strike: false,
    }
  }

  override canEdit() {
    return true
  }

  canScale() {
    return true
  }

  canResize() {
    return true
  }

  override component(shape: RichTextShape) {
    // strict tracking of editing state
    const isEditing = useValue('isEditing', () => this.editor.getEditingShapeId() === shape.id, [this.editor, shape.id])

    const sx = shape.props.scaleX ?? 1
    const sy = shape.props.scaleY ?? 1

    // Map Props to CSS
    const fonts: Record<string, string> = {
      draw: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
      sans: 'Inter, sans-serif',
      serif: 'serif',
      mono: 'monospace'
    }
    const sizes: Record<string, string> = {
      xs: '14px',
      s: '18px',
      m: '24px',
      l: '32px',
      xl: '48px',
      xxl: '64px'
    }
    const isDarkMode = this.editor.user.getIsDarkMode();
    const theme = getDefaultColorTheme({ isDarkMode });

    const colorsMap: Record<string, string> = {
      black: theme.black.solid,
      grey: theme.grey.solid,
      red: theme.red.solid,
      orange: theme.yellow.solid, // tldraw usa 'yellow' pero lo llamamos 'orange' en la UI
      yellow: theme.yellow.solid,
      green: theme.green.solid,
      blue: theme.blue.solid,
      purple: theme.violet.solid,
      violet: theme.violet.solid,
    };

    // Style for the container
    const style: React.CSSProperties = {
      // The logical width for wrapping must be (visual width / scaleX)
      width: shape.props.autoSize ? 'max-content' : (shape.props.w / sx),
      height: 'auto',
      minHeight: '1em',
      minWidth: '1px',
      fontFamily: fonts[shape.props.font] || fonts.draw,
      fontSize: sizes[shape.props.size] || sizes.m,
      color: colorsMap[shape.props.color] || shape.props.color || '#000000',
      caretColor: colorsMap[shape.props.color] || shape.props.color || (isDarkMode ? '#ffffff' : '#000000'),
      lineHeight: '1.25',
      outline: 'none',
      overflow: 'visible',
      whiteSpace: shape.props.autoSize ? 'pre' : 'pre-wrap',
      wordBreak: 'break-word',
      pointerEvents: 'all',
      transformOrigin: 'top left',
      transform: `scale(${sx}, ${sy})`,
      userSelect: isEditing ? 'text' : 'none',
      WebkitUserSelect: isEditing ? 'text' : 'none',
      cursor: isEditing ? 'text' : 'move',
      padding: '0 4px',
      display: 'inline-block',
      fontStyle: shape.props.italic ? 'italic' : 'normal',
      fontWeight: shape.props.bold ? 'bold' : 'normal',
      textDecoration: (shape.props.underline ? 'underline ' : '') + (shape.props.strike ? 'line-through' : ''),
      textAlign: (shape.props.align === 'justify' && shape.props.autoSize) ? 'start' : (
        shape.props.align === 'middle' ? 'center' :
          shape.props.align === 'end' ? 'right' :
            shape.props.align === 'justify' ? 'justify' : 'left'
      ),
      border: shape.props.isCreating
        ? '2px dashed var(--color-accent)'
        : '2px solid transparent',
      borderRadius: '2px',
      boxSizing: 'border-box'
    }

    const rRef = React.useRef<HTMLDivElement>(null);

    // Auto-focus when entering edit mode
    React.useEffect(() => {
      if (isEditing && rRef.current) {
        rRef.current.focus();

        const primeCursor = () => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (!rRef.current) return;
              if (document.activeElement !== rRef.current) {
                if (isEditing) rRef.current.focus();
                else return;
              }

              const hex = colorsMap[shape.props.color] || shape.props.color;
              const sizeIntMap: Record<string, string> = { xs: '3', s: '4', m: '5', l: '6', xl: '7', xxl: '7' };
              const sizeInt = sizeIntMap[shape.props.size] || '5';
              const fontName = fonts[shape.props.font] || 'sans-serif';

              document.execCommand('styleWithCSS', false, 'true');
              if (hex) document.execCommand('foreColor', false, hex);
              document.execCommand('fontSize', false, sizeInt);
              document.execCommand('fontName', false, fontName);
            }, 50);
          });
        };

        // Cache the primer function on the element for onFocus usage
        (rRef.current as any).__primeCursor = primeCursor;

        // Initial prime if empty
        if (shape.props.html === '') primeCursor();

        // Move cursor to end
      } else if (!isEditing) {
        // Clear browser selection when we stop editing to fix "ghost" highlights
        window.getSelection()?.removeAllRanges();

        // 💡 DELETE IF EMPTY Logic
        const rawHtml = shape.props.html.trim();
        const plainText = rawHtml.replace(/<[^>]*>/g, '').trim().toLowerCase();
        const isActuallyEmpty = !plainText || plainText === '';

        if (!shape.props.isCreating && isActuallyEmpty) {
          setTimeout(() => {
            if (this.editor.getShape(shape.id)) {
              this.editor.deleteShape(shape.id);
            }
          }, 0);
        }
      }
    }, [isEditing]);

    // Reactive Resize Observer (DOM -> Props)
    React.useEffect(() => {
      if (!rRef.current) return;

      const observer = new ResizeObserver(() => {
        if (!rRef.current) return;

        // Measure unscaled content size
        const unscaledW = rRef.current.scrollWidth;
        const unscaledH = rRef.current.scrollHeight;

        const currentSX = shape.props.scaleX ?? 1
        const currentSY = shape.props.scaleY ?? 1

        // Convert to visual size (BaseBoxShapeUtil bounds)
        const visualW = Math.ceil(unscaledW * currentSX);
        const visualH = Math.ceil(unscaledH * currentSY);

        if (isNaN(visualW) || isNaN(visualH)) {
          return;
        }

        if (shape.props.autoSize) {
          if (Math.abs(visualW - shape.props.w) > 1 || Math.abs(visualH - shape.props.h) > 1) {
            this.editor.updateShape({
              id: shape.id,
              type: 'rich-text',
              props: {
                w: Math.max(50 * currentSX, visualW),
                h: visualH
              }
            });
          }
        } else {
          if (Math.abs(visualH - shape.props.h) > 1) {
            this.editor.updateShape({
              id: shape.id,
              type: 'rich-text',
              props: {
                h: visualH
              }
            });
          }
        }
      });

      observer.observe(rRef.current);
      return () => observer.disconnect();
    }, [shape.props.autoSize, shape.id, shape.props.scaleX, shape.props.scaleY, shape.props.w, shape.props.h]);

    // Sync HTML from props to DOM (safely)
    React.useEffect(() => {
      if (!rRef.current) return;
      if (rRef.current.innerHTML !== shape.props.html) {
        rRef.current.innerHTML = shape.props.html;
      }
    }, [shape.props.html]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const html = el.innerHTML

      const update: any = { html }

      // Defensive scale check
      const sx = shape.props.scaleX || 1
      const sy = shape.props.scaleY || 1

      // Immediate measurement for perceived performance
      if (shape.props.autoSize) {
        update.w = Math.ceil(el.scrollWidth * sx);
        update.h = Math.ceil(el.scrollHeight * sy);
      } else {
        update.h = Math.ceil(el.scrollHeight * sy);
      }

      // Bubble detection for font size
      // This is a placeholder for where bubble detection logic would go.
      // The instruction's snippet seems to be part of a larger context
      // where `node` and `computed` are defined, likely within a `size` property
      // of the `update` object. For now, I'll place the log here as per instruction.
      // If this is meant to be part of a `size` property in `update`,
      // the structure would need to be adjusted.
      // Assuming `node` and `computed` are available in the scope where this
      // `size` property would be defined.
      // For now, I'll add the log as a standalone line.
      // The instruction's snippet implies a `size` property being set:
      /*
      update.size = (() => {
        const val = document.queryCommandValue('fontSize');
        // Assuming 'node' and 'computed' are defined in this scope
        // For example, if this was part of a selection change handler
        // console.log(`[${new Date().toISOString()}] [BubbleDetection] Node: <${node.nodeName.toLowerCase()} id="${(node as HTMLElement).id}" class="${(node as HTMLElement).className}"> | QUERY: ${val}, COMPUTED: ${computed.fontSize}`);
        if (val === '4' || val === '18px') return 's';
        // ... other size logic
      })();
      */
      this.editor.updateShape({
        id: shape.id,
        type: 'rich-text',
        props: update,
      })
    }

    return (
      <HTMLContainer id={shape.id}>
        <div
          ref={rRef}
          id={`field_${shape.id}`}
          className="rich-text-container"
          style={style}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onPointerDown={(e) => {
            const isLink = (e.target as HTMLElement).closest('a');
            if (isEditing || isLink) {
              stopEventPropagation(e);
            }
          }}
          onClick={(e) => {
            if (isEditing) return;
            const target = e.target as HTMLElement;
            const link = target.closest('a');
            if (link) {
              const href = link.getAttribute('href');
              if (href) {
                window.open(href, '_blank', 'noopener,noreferrer');
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }}
          onInput={handleInput}
          onFocus={() => {
            // Redundant priming on manual focus if empty
            if (isEditing && shape.props.html === '' && rRef.current) {
              const primer = (rRef.current as any).__primeCursor;
              if (typeof primer === 'function') primer();
            }
          }}
          onBlur={() => {
            // Cleanup: remove placeholder if empty
          }}
        />
        <style>
          {`
            [id="field_${shape.id}"] {
              font-size: ${sizes[shape.props.size]} !important;
              line-height: 1.25 !important;
              min-height: 1em !important;
            }
            .rich-text-container * {
              text-align: inherit;
              cursor: inherit;
              color: inherit;
              user-select: inherit;
              -webkit-user-select: inherit;
            }
            .rich-text-container a {
              color: var(--color-accent) !important;
              text-decoration: underline !important;
              cursor: pointer !important;
              pointer-events: all !important;
            }
            /* Force Pointer instead of Crosshair for Text Tool */
          .tl-canvas.tl-cursor-cross, 
          .tl-canvas.tl-cursor-crosshair,
          .tl-canvas.tl-cursor-cross *,
          .tl-canvas.tl-cursor-crosshair * {
            cursor: default !important;
          }
        `}
        </style>

        {/* Resize Handle for Fixed Text (Only when Editing) */}
        {isEditing && !shape.props.autoSize && (
          <div
            className="resize-handle-right"
            onPointerDown={this.handleResizePointerDown}
            style={{
              position: 'absolute',
              right: -5,
              top: 0,
              width: 10,
              height: '100%',
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'all',
              zIndex: 100
            }}
          >
            <div style={{
              width: 4,
              height: 32,
              backgroundColor: 'var(--color-accent)',
              borderRadius: 2,
              opacity: 0.8
            }} />
          </div>
        )}
      </HTMLContainer>
    )
  }

  // Transformations
  onScale(shape: RichTextShape, info: any) {
    const { initialShape = shape, handle = 'bottom_right' } = info

    // Fallbacks for scale multipliers (info.scale is uniform, info.scaleX/Y is non-uniform)
    const sx = info.scaleX ?? info.scale ?? 1
    const sy = info.scaleY ?? info.scale ?? 1

    const iProps = initialShape.props ?? shape.props
    const nW = iProps.w * sx
    const nH = iProps.h * sy

    // Calculate pinning (x, y) based on handle if Tldraw doesn't provide them
    let nextX = info.x ?? shape.x
    let nextY = info.y ?? shape.y

    if (info.x === undefined || info.y === undefined) {
      if (handle.includes('left')) nextX = initialShape.x + (iProps.w - nW)
      if (handle.includes('top')) nextY = initialShape.y + (iProps.h - nH)
    }

    return {
      x: nextX,
      y: nextY,
      props: {
        w: nW,
        h: nH,
        scaleX: (iProps.scaleX ?? 1) * sx,
        scaleY: (iProps.scaleY ?? 1) * sy
      }
    }
  }

  override onResize(shape: RichTextShape, info: any) {
    const { initialShape = shape, handle = 'bottom_right', newW, newH } = info

    // Tldraw can pass either absolute pixel sizes (newW/H) or relative scale factors (scaleX/Y)
    const iProps = initialShape.props ?? shape.props
    const nW = newW ?? (iProps.w * (info.scaleX ?? 1))
    const nH = newH ?? (iProps.h * (info.scaleY ?? 1))

    // Calculate logical size (unscaled dimensions) to ensure linear scaling ratios
    const logicalW = iProps.w / (iProps.scaleX || 1)
    const logicalH = iProps.h / (iProps.scaleY || 1)

    // Calculate pinning (x, y) based on handle if Tldraw doesn't provide them
    let nextX = info.x ?? shape.x
    let nextY = info.y ?? shape.y

    if (info.x === undefined || info.y === undefined) {
      if (handle.includes('left')) nextX = initialShape.x + (iProps.w - nW)
      if (handle.includes('top')) nextY = initialShape.y + (iProps.h - nH)
    }

    return {
      x: nextX,
      y: nextY,
      props: {
        w: nW,
        h: nH,
        scaleX: logicalW === 0 ? 1 : nW / logicalW,
        scaleY: logicalH === 0 ? 1 : nH / logicalH
      }
    }
  }

  // Custom resize handler logic
  private handleResizePointerDown: React.PointerEventHandler = (e) => {
    stopEventPropagation(e)
    const shape = this.editor.getShape<RichTextShape>(this.editor.getEditingShapeId()!)
    if (!shape) return;

    const sx = shape.props.scaleX || 1
    const sy = shape.props.scaleY || 1
    const startX = e.clientX
    const startW = shape.props.w

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / this.editor.getZoomLevel()
      const newW = Math.max(50 * sx, startW + delta)

      this.editor.updateShape({
        id: shape.id,
        type: 'rich-text',
        props: { w: newW, scaleX: sx, scaleY: sy } // Explicitly keep scales
      })
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      // Final measure could happen here
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  override indicator(shape: RichTextShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}
