import {
  SVGContainer,
  track,
  useValue,
  getDefaultColorTheme,
} from 'tldraw'
import {
  HTMLContainer,
} from '@tldraw/editor'
import type {
  TLGeoShape,
} from 'tldraw'
import { FillColorStyle, FillOpacityStyle, StrokeOpacityStyle } from '../styles/customStyles'
import { getGeoShapePath } from './geoPath'
import { RichTextLabel } from 'tldraw'
import type { CustomGeoShapeUtil } from './CustomGeoShapeUtil'

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

const STROKE_SIZES: Record<string, number> = {
  s: 2,
  m: 3.5,
  l: 5,
  xl: 10,
}

// Simplified ShapeFill since we can't easily import the internal one
export const ShapeFill = ({ theme, d, color, fill }: any) => {
  if (fill === 'none') return null;

  // Use solid color; let the container's opacity handle the "pastel" look
  const fillColor = theme[color]?.solid || color;

  return (
    <path
      fill={fillColor}
      d={d}
    />
  );
};

export const GeoShapeComponent = track(({ shape, util }: { shape: TLGeoShape; util: CustomGeoShapeUtil }) => {
  const { id, type, props } = shape
  const {
    color, fill, dash, size, font, align, verticalAlign, scale, richText
  } = props as any

  const fillColor = (props as any)[FillColorStyle.id] || 'black'
  const fillOpacity = parseFloat((props as any)[FillOpacityStyle.id] || '1')
  const strokeOpacity = parseFloat((props as any)[StrokeOpacityStyle.id] || '1')

  const isSelected = useValue(
    'isGeoSelected',
    () => util.editor.getOnlySelectedShapeId() === id,
    [util.editor, id]
  )

  const isDarkMode = util.editor.user.getIsDarkMode()
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
        <g>
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
              props: { fill: 'none', stroke: (theme as any)[color]?.solid || color }
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
          isSelected={isSelected}
          labelColor={(theme as any)[color]?.solid || color}
          wrap={true}
        />
      </HTMLContainer>
    </>
  )
})
