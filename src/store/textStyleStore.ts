import { create } from 'zustand';

interface TextStyleState {
  color: string;
  size: string;
  font: string;
  align: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;

  // Actions
  updateStyles: (styles: Partial<TextStyleState>) => void;
}

export const useTextStyleStore = create<TextStyleState>((set) => ({
  color: 'black',
  size: 'm',
  font: 'sans',
  align: 'start',
  bold: false,
  italic: false,
  underline: false,
  strike: false,

  updateStyles: (styles) => set((state) => ({ ...state, ...styles })),
}));
