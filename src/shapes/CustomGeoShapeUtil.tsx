import {
  GeoShapeUtil,
  geoShapeProps,
  SVGContainer,
  useValue,
  getDefaultColorTheme,
} from 'tldraw'
import {
  Rectangle2d,
  HTMLContainer,
} from '@tldraw/editor'
import type {
  TLGeoShape,
  Geometry2d,
} from 'tldraw'
import * as React from 'react'
import { FillColorStyle, FillOpacityStyle, StrokeOpacityStyle } from '../styles/customStyles'
import { getGeoShapePath } from './geoPath'

// We need to import RichTextLabel from where it's actually exported
// In GeoShapeUtil.mjs it was imported from ../shared/RichTextLabel.mjs
// It's usually re-exported by tldraw.
import { RichTextLabel } from 'tldraw'

// Constants from tldraw internal
const LABEL_FONT_SIZES: Record<string, number> = {
  s: 14,
  m: 16,
  l: 20,
  xl: 28,
}
const LABEL_PADDING = 12
const TEXT_PROPS = {
  lineHeight: 1.2,
}

// Simplified ShapeFill since we can't easily import the internal one
const ShapeFill = ({ theme, d, color, fill }: any) => {
  if (fill === 'none') return null;

  const fillColor = theme[color]?.semi || color;

  return (
    <path
      fill={fillColor}
      fillOpacity={fill === 'semi' ? 0.5 : 1}
      d={d}
    />
  );
};

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
      [FillOpacityStyle.id]: '1',
      [StrokeOpacityStyle.id]: '1',
    }
  }

  override component(shape: TLGeoShape) {
    const { id, type, props } = shape
    const {
      geo, color, fill, dash, size, font, align, verticalAlign, text, scale, richText
    } = props

    const fillColor = (props as any)[FillColorStyle.id] || 'black'
    const fillOpacity = parseFloat((props as any)[FillOpacityStyle.id] || '1')
    const strokeOpacity = parseFloat((props as any)[StrokeOpacityStyle.id] || '1')

    const isOnlySelected = useValue(
      "isGeoOnlySelected",
      () => shape.id === this.editor.getOnlySelectedShapeId(),
      [this.editor]
    )
    const isDarkMode = this.editor.user.getIsDarkMode()
    const theme = getDefaultColorTheme({ isDarkMode })

    const path = getGeoShapePath(shape)
    const sw = STROKE_SIZES[size] * scale

    const isForceSolid = false
    const fillPath = dash === 'draw' && !isForceSolid
      ? path.toDrawD({ strokeWidth: sw, randomSeed: shape.id, passes: 1, offset: 0, onlyFilled: true })
      : path.toD({ onlyFilled: true })

    return (
      <>
        <SVGContainer id={id}>
          <g transform={`scale(${1})`}>
            {/* Fill Layer */}
            <g opacity={fillOpacity}>
              <ShapeFill
                theme={theme}
                d={fillPath}
                color={fillColor}
                fill={fill}
              />
            </g>
            {/* Stroke Layer */}
            <g opacity={strokeOpacity}>
              {path.toSvg({
                style: dash,
                strokeWidth: sw,
                forceSolid: isForceSolid,
                randomSeed: shape.id,
                props: { fill: 'none', stroke: theme[color]?.solid || color }
              })}
            </g>
          </g>
        </SVGContainer>
        <HTMLContainer
          style={{
            overflow: "hidden",
            width: shape.props.w,
            height: (shape.props.h + (shape.props.growY ?? 0))
          }}
        >
          <RichTextLabel
            shapeId={id}
            type={type}
            font={font}
            fontSize={LABEL_FONT_SIZES[size] * scale}
            lineHeight={TEXT_PROPS.lineHeight}
            padding={LABEL_PADDING * scale}
            fill={fill}
            align={align}
            verticalAlign={verticalAlign}
            richText={richText}
            isSelected={isOnlySelected}
            labelColor={theme[color]?.solid || color}
            wrap={true}
          />
        </HTMLContainer>
      </>
    )
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

  override getGeometry(shape: TLGeoShape): Geometry2d {
    const w = Math.max(1, shape.props.w)
    const h = Math.max(1, shape.props.h + (shape.props.growY ?? 0))
    return new Rectangle2d({
      x: 0,
      y: 0,
      width: w,
      height: h,
      isFilled: shape.props.fill !== 'none',
    })
  }
}
