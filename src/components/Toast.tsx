import React, { useState, useCallback } from 'react';

interface ToastItem {
  id: number;
  message: string;
}

let nextId = 0;

const Toast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2000);
  }, []);

  (window as unknown as Record<string, unknown>).__toast = show;

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast-item">{t.message}</div>
      ))}
    </div>
  );
};

export function showToast(message: string) {
  const show = (window as unknown as Record<string, unknown>).__toast as ((msg: string) => void) | undefined;
  if (show) show(message);
}

export default Toast;