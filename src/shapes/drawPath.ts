import { PathBuilder } from './PathBuilder'
import type { TLDrawShape } from 'tldraw'
import { Vec } from 'tldraw'

export function getDrawShapePath(shape: TLDrawShape) {
  const { segments, isClosed } = shape.props

  // Flatten all points from all segments
  // Draw shapes typically just have a list of points in segments
  const allPoints = segments.flatMap(s => s.points.map(p => new Vec(p.x, p.y)))

  if (allPoints.length === 0) return new PathBuilder()

  // Use cubic spline for smooth ink-like path
  // If only 1 or 2 points, cubicSpline might behave like line
  const builder = PathBuilder.cubicSplineThroughPoints(allPoints)

  if (isClosed) {
    builder.close()
  }

  return builder
}
