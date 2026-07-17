import React, { useRef, useLayoutEffect, useState } from 'react';

interface ContextMenuPortalProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

const ContextMenuPortal: React.FC<ContextMenuPortalProps> = ({ x, y, onClose, children }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });
  const [opensUpward, setOpensUpward] = useState(false);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = y;
    let left = x;

    const shouldOpenUpward = rect.bottom > viewportH;
    if (shouldOpenUpward) {
      top = Math.max(8, viewportH - rect.height - 8);
    }
    if (rect.right > viewportW) {
      left = Math.max(8, viewportW - rect.width - 8);
    }

    setPos((previous) => previous.top === top && previous.left === left ? previous : { top, left });
    setOpensUpward((previous) => previous === shouldOpenUpward ? previous : shouldOpenUpward);
  }, [x, y]);

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        ref={menuRef}
        className={`context-menu${opensUpward ? ' context-menu-opens-upward' : ''}`}
        style={{
          top: `calc(${pos.top}px / var(--zoom))`,
          left: `calc(${pos.left}px / var(--zoom))`,
        }}
      >
        {children}
      </div>
    </>
  );
};

export default ContextMenuPortal;
