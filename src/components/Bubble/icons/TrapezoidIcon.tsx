interface TrapezoidIconProps {
  size?: number;
}

/**
 * Trapezoid shape icon for the shape selector.
 */
export const TrapezoidIcon = ({ size = 16 }: TrapezoidIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 5h8l4 10H2L6 5z" />
  </svg>
);
