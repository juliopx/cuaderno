/**
 * Parses an SVG path data string and calculates its bounding box.
 * Supports basic M, L, Q, C commands commonly used in freehand drawing.
 */
export const getSvgPathBoundingBox = (pathData: string) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // Very basic parser for points in path data
  // Extracts all numbers that look like coordinates
  const numbers = pathData.match(/-?\d*\.?\d+/g)?.map(Number);

  if (!numbers || numbers.length < 2) {
    return { x: 0, y: 0, width: 0, height: 0, isEmpty: true };
  }

  // Assuming coordinates come in pairs (x, y)
  // This is a simplification but works for simple polyline/curve strokes
  for (let i = 0; i < numbers.length; i += 2) {
    const x = numbers[i];
    const y = numbers[i + 1];

    // Skip if not a number or NaN
    if (isNaN(x) || isNaN(y)) continue;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Add some padding
  const padding = 4;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    isEmpty: false
  };
};
