import { useState, useRef, useEffect } from 'react';
import { HybridName } from '../UI/HybridName';
import styles from './RenameOverlay.module.css';
import { X } from 'lucide-react';

interface RenameOverlayTextModeProps {
  name: string;
  setName: (name: string) => void;
  strokes?: string;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  onSave: () => void;
  onClear: () => void;
  onCancel: () => void;
  colorsMap: Record<string, string>;
}

export const RenameOverlayTextMode = ({
  name,
  setName,
  strokes,
  selectedColor,
  setSelectedColor,
  onSave,
  onClear,
  onCancel,
  colorsMap
}: RenameOverlayTextModeProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleScroll = () => {
    if (inputRef.current) {
      setScrollLeft(inputRef.current.scrollLeft);
    }
  };

  useEffect(() => {
    // Initial sync and periodic check for focus-driven scrolls
    const timer = setInterval(handleScroll, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper} style={{ color: colorsMap[selectedColor] }}>
        <HybridName
          name={name || ' '}
          strokes={strokes}
          color={colorsMap[selectedColor]}
          className={styles.textModeDrawing}
          scale={2}
          isRtl={false}
          hideText={true}
          isEditor={true}
          scrollLeft={scrollLeft}
        />
        <input
          ref={inputRef}
          autoFocus
          className={styles.input}
          value={name}
          onFocus={(e) => {
            e.target.select();
            handleScroll();
          }}
          onChange={(e) => {
            setName(e.target.value);
            // Scroll usually doesn't update until next frame
            setTimeout(handleScroll, 0);
          }}
          onScroll={handleScroll}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <div className={styles.actions}>
        <div className={styles.colorsRow}>
          {Object.entries(colorsMap).map(([cName, hex]) => (
            <button
              key={cName}
              className={styles.colorSwatch}
              style={{
                backgroundColor: hex,
                outline: selectedColor === cName ? '2px solid var(--color-accent)' : 'none',
                outlineOffset: '2px'
              }}
              onClick={() => setSelectedColor(cName)}
              title={cName}
            />
          ))}
        </div>

        <div className={styles.buttonsGroup}>
          <button className={styles.btn} onClick={onClear} title="Clear All">
            <X size={20} />
          </button>
          <button className={styles.confirm} onClick={onSave}>
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
};
