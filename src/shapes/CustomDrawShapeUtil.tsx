import { DrawShapeUtil, drawShapeProps } from 'tldraw'
import { FillColorStyle, FillOpacityStyle, StrokeOpacityStyle } from '../styles/customStyles'

export class CustomDrawShapeUtil extends DrawShapeUtil {
  static override type = 'draw' as const

  static override props = {
    ...drawShapeProps,
    [FillColorStyle.id]: FillColorStyle,
    [FillOpacityStyle.id]: FillOpacityStyle,
    [StrokeOpacityStyle.id]: StrokeOpacityStyle,
  }

  override getDefaultProps() {
    return {
      ...super.getDefaultProps(),
      [FillColorStyle.id]: 'black',
      [FillOpacityStyle.id]: '0',
      [StrokeOpacityStyle.id]: '1',
    }
  }
}
