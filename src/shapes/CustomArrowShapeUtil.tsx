import { ArrowShapeUtil, arrowShapeProps } from 'tldraw'
import { FillColorStyle, FillOpacityStyle, StrokeOpacityStyle } from '../styles/customStyles'

export class CustomArrowShapeUtil extends ArrowShapeUtil {
  static override type = 'arrow' as const

  static override props = {
    ...arrowShapeProps,
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
