import { useState, useEffect } from 'react';
import { applyTheme } from '@/utils/theme';
import { DEFAULT_COLOR_THEME_ID } from '@/themes';

export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    applyTheme(DEFAULT_COLOR_THEME_ID, isDark);
  }, [isDark]);

  const toggle = () => {
    setIsDark((prev: boolean) => !prev);
  };

  return { isDark, toggle };
}