
export const getIsDarkMode = (theme: string): boolean => {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  // auto
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};
