import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { DefaultSizeStyle, STROKE_SIZES, FONT_SIZES } from 'tldraw'

// Monkey-patch Tldraw constants to support extra sizes
if (DefaultSizeStyle) {
  const dss = DefaultSizeStyle as any;
  if (dss.values && !dss.values.includes('xs')) {
    dss.values.push('xs', 'xxl');
  }

  // Helper to wrap validator
  const wrapValidator = (obj: any) => {
    if (obj && obj.validate) {
      const original = obj.validate.bind(obj);
      obj.validate = (value: any) => {
        if (value === 'xs' || value === 'xxl') return value;
        return original(value);
      };
    }
  };

  wrapValidator(dss);
  wrapValidator(dss.type);

  // If it's an enum style, it might have internal validators
  if (dss.props && dss.props.type) wrapValidator(dss.props.type);
}
if (STROKE_SIZES) {
  (STROKE_SIZES as any).xs = 1.2;
  (STROKE_SIZES as any).xxl = 24;
}
if (FONT_SIZES) {
  (FONT_SIZES as any).xs = 14;
  (FONT_SIZES as any).xxl = 64;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
