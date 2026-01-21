import { LineShapeUtil, lineShapeProps } from 'tldraw'
import { FillColorStyle, FillOpacityStyle, StrokeOpacityStyle } from '../styles/customStyles'

export class CustomLineShapeUtil extends LineShapeUtil {
  static override type = 'line' as const

  static override props = {
    ...lineShapeProps,
    [FillColorStyle.id]: FillColorStyle,
    [FillOpacityStyle.id]: FillOpacityStyle,
    [StrokeOpacityStyle.id]: StrokeOpacityStyle,
  }

  override getDefaultProps() {
    return {
      ...super.getDefaultProps(),
      [FillColorStyle.id]: 'black',
      [FillOpacityStyle.id]: '1',
      [StrokeOpacityStyle.id]: '1',
    }
  }
}
