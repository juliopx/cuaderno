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

  // Draw Tool Styles
  drawColor: string;
  drawSize: string;
  drawOpacity: string;
  drawDash: string;

  // Shape Tool Styles (geo, arrow, line)
  shapeColor: string;
  shapeSize: string;
  shapeOpacity: string;
  shapeDash: string;
  shapeFill: string;
  shapeFillColor: string;
  shapeFillOpacity: string;

  // UI State (Persisted locally only)
  bubbleCollapsed: boolean;
  bubblePosition: { x: number; y: number } | null;

  lastUsedGeo: string;
  lastActiveTool: string;

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

      drawColor: 'black',
      drawSize: 's', // Changed from 'm' to 's' (Very Small/Small)
      drawOpacity: '1',
      drawDash: 'solid',

      shapeColor: 'black',
      shapeSize: 'm',
      shapeOpacity: '1',
      shapeDash: 'solid',
      shapeFill: 'none',
      shapeFillColor: 'black',
      shapeFillOpacity: '0.1',

      // UI Defaults
      bubbleCollapsed: false,
      bubblePosition: null, // Will use default in component if null

      lastUsedGeo: 'rectangle',
      lastActiveTool: 'draw', // Default to draw (Pencil)

      updatePreferences: (prefs) => set((state) => ({ ...state, ...prefs })),
    }),
    {
      name: 'cuaderno-user-preferences',
    }
  )
);
