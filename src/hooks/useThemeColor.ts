import { useMemo } from 'react';
import { getThemeColorHex } from '../lib/colorUtils';

export const useThemeColorHex = (colorName: string, isDarkMode: boolean) => {
  return useMemo(() => getThemeColorHex(colorName, isDarkMode), [colorName, isDarkMode]);
};
