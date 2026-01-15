
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

interface UIPortalProps {
  children: ReactNode;
}

export const UIPortal = ({ children }: UIPortalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const portalRoot = document.getElementById('ui-portal-root');
  if (!portalRoot) {
    // Fallback to body if root not found (though it should be in App.tsx)
    return createPortal(children, document.body);
  }

  return createPortal(children, portalRoot);
};
