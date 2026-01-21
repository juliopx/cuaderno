import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferencesState {
  // Text Styles
  textColor: string;
  textSize: string;
  textFont: string;
  textAlign: string;
  textBold: boolean;
  textItalic: boolean;
  textUnderline: boolean;
  textStrike: boolean;

  // Shape Styles
  strokeColor: string;
  strokeSize: string;
  strokeOpacity: string;
  dashStyle: string;
  fillStyle: string;
  fillColor: string;
  fillOpacity: string;
  lastUsedGeo: string;

  // Actions
  updatePreferences: (prefs: Partial<UserPreferencesState>) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      // Default Values
      textColor: 'black',
      textSize: 'm',
      textFont: 'sans',
      textAlign: 'start',
      textBold: false,
      textItalic: false,
      textUnderline: false,
      textStrike: false,

      strokeColor: 'black',
      strokeSize: 'm',
      strokeOpacity: '1',
      dashStyle: 'solid',
      fillStyle: 'none',
      fillColor: 'black',
      fillOpacity: '1',
      lastUsedGeo: 'rectangle',

      updatePreferences: (prefs) => set((state) => ({ ...state, ...prefs })),
    }),
    {
      name: 'cuaderno-user-preferences',
    }
  )
);
