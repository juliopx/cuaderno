import { useEffect } from 'react';
import { Editor } from 'tldraw';

export const useEraserOverride = (editor: Editor) => {
  useEffect(() => {
    if (!editor) return;

    const originalIsErasable = (editor as any).isShapeErasable ? (editor as any).isShapeErasable.bind(editor) : null;

    // Try both new and old names just in case
    // eslint-disable-next-line react-hooks/immutability
    (editor as any).isErasable = (shape: any) => {
      if (editor.getCurrentToolId() === 'eraser') return shape.type === 'draw';
      return originalIsErasable ? originalIsErasable(shape) : true;
    };
    (editor as any).isShapeErasable = (editor as any).isErasable;

    return () => {
      // Restore
      if (editor) {
        if (originalIsErasable) {
          (editor as any).isErasable = originalIsErasable;
          (editor as any).isShapeErasable = originalIsErasable;
        } else {
          delete (editor as any).isErasable;
          delete (editor as any).isShapeErasable;
        }
      }
    };
  }, [editor]);
};
