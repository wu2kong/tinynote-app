import React, { useRef, useLayoutEffect, useState } from 'react';

interface ContextMenuPortalProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

const ContextMenuPortal: React.FC<ContextMenuPortalProps> = ({ x, y, onClose, children }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: `calc(${y}px / var(--zoom))`, left: `calc(${x}px / var(--zoom))` });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = `calc(${y}px / var(--zoom))`;
    let left = `calc(${x}px / var(--zoom))`;

    if (rect.bottom > viewportH) {
      const adjTop = Math.max(8, viewportH - rect.height - 8);
      top = `${adjTop}px`;
    }
    if (rect.right > viewportW) {
      const adjLeft = Math.max(8, viewportW - rect.width - 8);
      left = `${adjLeft}px`;
    }

    if (top !== pos.top || left !== pos.left) {
      setPos({ top, left });
    }
  }, [x, y]);

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div ref={menuRef} className="context-menu" style={{ top: pos.top, left: pos.left }}>
        {children}
      </div>
    </>
  );
};

export default ContextMenuPortal;
