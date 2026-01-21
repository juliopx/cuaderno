import {
  GeoShapeUtil,
  geoShapeProps,
  getDefaultColorTheme,
} from 'tldraw'
import {
  Group2d,
} from '@tldraw/editor'
import type {
  TLGeoShape,
} from 'tldraw'
import { FillColorStyle, FillOpacityStyle, StrokeOpacityStyle } from '../styles/customStyles'
import { getGeoShapePath } from './geoPath'
import { GeoShapeComponent, ShapeFill } from './CustomGeoShapeComponent'

const STROKE_SIZES: Record<string, number> = {
  s: 2,
  m: 3.5,
  l: 5,
  xl: 10,
}


export class CustomGeoShapeUtil extends GeoShapeUtil {
  static override type = 'geo' as const

  static override props = {
    ...geoShapeProps,
    [FillColorStyle.id]: FillColorStyle,
    [FillOpacityStyle.id]: FillOpacityStyle,
    [StrokeOpacityStyle.id]: StrokeOpacityStyle,
  }

  override getDefaultProps() {
    return {
      ...super.getDefaultProps(),
      [FillColorStyle.id]: 'black',
      [FillOpacityStyle.id]: '0.1',
      [StrokeOpacityStyle.id]: '1',
    }
  }

  override component(shape: TLGeoShape) {
    return <GeoShapeComponent shape={shape} util={this} />
  }

  override toSvg(shape: TLGeoShape) {
    const theme = getDefaultColorTheme({ isDarkMode: this.editor.user.getIsDarkMode() })
    const { color, fill, dash, size, scale } = shape.props

    const fillColor = (shape.props as any)[FillColorStyle.id] || 'black'
    const fillOpacity = parseFloat((shape.props as any)[FillOpacityStyle.id] || '1')
    const strokeOpacity = parseFloat((shape.props as any)[StrokeOpacityStyle.id] || '1')

    const path = getGeoShapePath(shape)
    const sw = STROKE_SIZES[size] * scale
    const fillPath = dash === 'draw'
      ? path.toDrawD({ strokeWidth: sw, randomSeed: shape.id, passes: 1, offset: 0, onlyFilled: true })
      : path.toD({ onlyFilled: true })

    return (
      <g>
        <g opacity={fillOpacity}>
          <ShapeFill
            theme={theme}
            d={fillPath}
            color={fillColor}
            fill={fill}
          />
        </g>
        <g opacity={strokeOpacity}>
          {path.toSvg({
            style: dash,
            strokeWidth: sw,
            randomSeed: shape.id,
            props: { fill: 'none', stroke: theme[color]?.solid || color }
          })}
        </g>
      </g>
    )
  }

  override getGeometry(shape: TLGeoShape) {
    const geometry = getGeoShapePath(shape).toGeometry()
    // GeoShapeUtil expects a Group2d
    if (geometry instanceof Group2d) {
      return geometry
    }
    return new Group2d({ children: [geometry] })
  }
}
