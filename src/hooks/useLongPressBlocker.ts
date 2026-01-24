import { useEffect } from 'react';
import { Editor } from 'tldraw';

export const useLongPressBlocker = (editor: Editor) => {
  useEffect(() => {
    const container = editor.getContainer();
    if (!container) return;

    const LONG_PRESS_DURATION = 600;
    const MOVEMENT_THRESHOLD = 10;
    let longpressTimer: any = null;
    let longpressStart: { x: number; y: number; target: EventTarget | null } | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      if ((e.pointerType === 'touch' || e.pointerType === 'pen') &&
        editor.getCurrentToolId() === 'select' &&
        !editor.getEditingShapeId() &&
        e.button === 0) {
        longpressStart = { x: e.clientX, y: e.clientY, target: e.target };
        longpressTimer = setTimeout(() => {
          if (longpressStart) {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
              (window.navigator as any).standalone ||
              document.referrer.includes('android-app://');

            if (isStandalone) {
              const blocker = document.createElement('div');
              Object.assign(blocker.style, {
                position: 'fixed', inset: '0', zIndex: '100000',
                backgroundColor: 'transparent', pointerEvents: 'auto', touchAction: 'none'
              });

              let isRemoving = false;
              const cleanup = () => {
                if (blocker.parentNode) document.body.removeChild(blocker);
                ['pointerdown', 'pointerup', 'touchend', 'click', 'contextmenu'].forEach(ev =>
                  window.removeEventListener(ev, handleEvent, { capture: true })
                );
              };

              const handleEvent = (ev: any) => {
                const x = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
                const y = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
                if ((ev.type === 'pointerdown' || ev.type === 'touchstart') && isRemoving) {
                  if (longpressStart && Math.hypot(x - longpressStart.x, y - longpressStart.y) > 40) {
                    cleanup(); return;
                  }
                }
                ev.preventDefault();
                ev.stopImmediatePropagation();
                if (['pointerup', 'touchend', 'click'].includes(ev.type)) {
                  if (!isRemoving) {
                    isRemoving = true;
                    setTimeout(cleanup, 250);
                  }
                }
              };

              ['pointerdown', 'pointerup', 'touchend', 'click', 'contextmenu'].forEach(ev =>
                window.addEventListener(ev, handleEvent, { capture: true })
              );
              document.body.appendChild(blocker);
            }

            const contextMenuEvent = new MouseEvent('contextmenu', {
              bubbles: true, cancelable: true,
              clientX: longpressStart.x, clientY: longpressStart.y,
            });
            longpressStart.target?.dispatchEvent(contextMenuEvent);
            longpressStart = null;
          }
        }, LONG_PRESS_DURATION);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (longpressStart && longpressTimer) {
        if (Math.hypot(e.clientX - longpressStart.x, e.clientY - longpressStart.y) > MOVEMENT_THRESHOLD) {
          clearTimeout(longpressTimer);
          longpressTimer = null;
          longpressStart = null;
        }
      }
    };

    const handlePointerUp = () => {
      if (longpressTimer) {
        clearTimeout(longpressTimer);
        longpressTimer = null;
        longpressStart = null;
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
      if (longpressTimer) clearTimeout(longpressTimer);
    };
  }, [editor]);
};
