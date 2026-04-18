import { useState, useEffect } from 'react';
import { applyTheme } from '@/utils/theme';

export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  const toggle = () => {
    setIsDark((prev: boolean) => !prev);
  };

  return { isDark, toggle };
}