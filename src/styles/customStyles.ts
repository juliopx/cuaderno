import { StyleProp, T } from 'tldraw';

export const FillColorStyle = StyleProp.defineEnum('cuaderno:fillColor', {
  defaultValue: 'black',
  values: ['black', 'grey', 'red', 'orange', 'green', 'blue', 'purple', 'violet'],
});

// Using T.any to be as permissive as possible and avoid validation crashes
// during the transition or if tldraw sends numbers instead of strings.
export const FillOpacityStyle = StyleProp.define('cuaderno:fillOpacity', {
  defaultValue: '1',
  type: T.any,
});

export const StrokeOpacityStyle = StyleProp.define('cuaderno:strokeOpacity', {
  defaultValue: '1',
  type: T.any,
});

