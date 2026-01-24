interface ScribbleIconProps {
  strokeWidth: number;
  color?: string;
}

/**
 * Generic scribble SVG icon used for draw tool indicator.
 */
export const ScribbleIcon = ({ strokeWidth, color = 'currentColor' }: ScribbleIconProps) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 14c2-4 5-6 8-2s6 2 8 0" />
  </svg>
);
