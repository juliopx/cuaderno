/**
 * Size mapping from string keys to stroke width numbers.
 */
export const sizeMap: Record<string, number> = {
  xs: 1,
  s: 1.5,
  m: 2.5,
  l: 4,
  xl: 6,
  xxl: 10,
};

/**
 * Font family mappings for rich text styling.
 */
export const fontFamilies: Record<string, string> = {
  draw: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
  sans: 'Inter, sans-serif',
  serif: 'serif',
  mono: 'monospace'
};

/**
 * Font size mappings for execCommand (fontSize uses 1-7 scale).
 */
export const fontSizes: Record<string, string> = {
  xs: '3',
  s: '4',
  m: '5',
  l: '6',
  xl: '7',
  xxl: '7'
};

/**
 * Applies a style strictly to all elements within the rich-text content,
 * preserving structure but enforcing the new property value on every node.
 * This replaces the old "unify" behavior which stripped styles and wrapped globally.
 */
export const applyStyleToRichText = (html: string, prop: string, value: any): string => {
  if (!html) return html;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const elements = Array.from(tempDiv.querySelectorAll('*'));

  if (elements.length === 0 && tempDiv.textContent?.trim()) {
    // If pure text, wrap it so we can style it
    const wrapper = document.createElement('span');
    while (tempDiv.firstChild) {
      wrapper.appendChild(tempDiv.firstChild);
    }
    tempDiv.appendChild(wrapper);
    elements.push(wrapper);
  }

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;

    if (prop === 'color') {
      htmlEl.style.color = value;
    }
    if (prop === 'font') {
      htmlEl.style.fontFamily = fontFamilies[value] || 'sans-serif';
    }
    if (prop === 'size') htmlEl.style.fontSize = '';

    if (prop === 'size') htmlEl.style.fontSize = '';
    if (prop === 'font') htmlEl.style.fontFamily = '';
    if (prop === 'align') htmlEl.style.textAlign = '';

    // Toggles
    if (prop === 'bold') {
      if (value) {
        htmlEl.style.fontWeight = 'bold';
      } else {
        htmlEl.style.fontWeight = 'normal';
        if (htmlEl.tagName === 'B' || htmlEl.tagName === 'STRONG') {
          htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
        }
      }
    }
    if (prop === 'italic') {
      if (value) {
        htmlEl.style.fontStyle = 'italic';
      } else {
        htmlEl.style.fontStyle = 'normal';
        if (htmlEl.tagName === 'I' || htmlEl.tagName === 'EM') {
          htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
        }
      }
    }
    if (prop === 'underline') {
      const current = htmlEl.style.textDecoration;
      let parts = current.split(' ').map(s => s.trim()).filter(Boolean);
      if (value) {
        if (!parts.includes('underline')) parts.push('underline');
      } else {
        parts = parts.filter(p => p !== 'underline');
        if (htmlEl.tagName === 'U') {
          htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
          return; // Element is gone, stop processing it
        }
      }
      htmlEl.style.textDecoration = parts.join(' ');
    }
    if (prop === 'strike') {
      const current = htmlEl.style.textDecoration;
      let parts = current.split(' ').map(s => s.trim()).filter(Boolean);
      if (value) {
        // 'line-through' is standard
        if (!parts.includes('line-through')) parts.push('line-through');
      } else {
        parts = parts.filter(p => p !== 'line-through');
        if (htmlEl.tagName === 'S' || htmlEl.tagName === 'STRIKE' || htmlEl.tagName === 'DEL') {
          htmlEl.replaceWith(...Array.from(htmlEl.childNodes));
          return; // Element is gone
        }
      }
      htmlEl.style.textDecoration = parts.join(' ');
    }
  });

  return tempDiv.innerHTML;
};
