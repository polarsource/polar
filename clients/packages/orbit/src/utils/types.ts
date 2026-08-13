import type {
  BackgroundColorToken,
  BorderColorToken,
  TextColorToken,
} from '../tokens/semantics.stylex'
import type {
  BorderRadiusToken,
  BreakpointKey,
  DurationToken,
  EasingToken,
  PositiveSpacingToken,
  ShadowToken,
  SpacingToken,
} from '../tokens/value.stylex'

export type PseudoState =
  | 'hover'
  | 'focus'
  | 'active'
  | 'focusVisible'
  | 'focusWithin'

export type ResponsiveValue<T> =
  | T
  | Partial<Record<'base' | BreakpointKey | PseudoState, T>>

/**
 * Offsets accept spacing tokens (positive or negative) with autocomplete,
 * plus arbitrary CSS lengths (`string & {}` keeps the literal suggestions
 * without rejecting other strings) and numbers (treated as px).
 */
export type OffsetValue = SpacingToken | (string & {}) | number

export interface SpacingProps {
  padding?: ResponsiveValue<PositiveSpacingToken>
  paddingTop?: ResponsiveValue<PositiveSpacingToken>
  paddingRight?: ResponsiveValue<PositiveSpacingToken>
  paddingBottom?: ResponsiveValue<PositiveSpacingToken>
  paddingLeft?: ResponsiveValue<PositiveSpacingToken>
  paddingHorizontal?: ResponsiveValue<PositiveSpacingToken>
  paddingVertical?: ResponsiveValue<PositiveSpacingToken>
  p?: ResponsiveValue<PositiveSpacingToken>
  pt?: ResponsiveValue<PositiveSpacingToken>
  pr?: ResponsiveValue<PositiveSpacingToken>
  pb?: ResponsiveValue<PositiveSpacingToken>
  pl?: ResponsiveValue<PositiveSpacingToken>
  px?: ResponsiveValue<PositiveSpacingToken>
  py?: ResponsiveValue<PositiveSpacingToken>

  margin?: ResponsiveValue<SpacingToken | 'auto'>
  marginTop?: ResponsiveValue<SpacingToken | 'auto'>
  marginRight?: ResponsiveValue<SpacingToken | 'auto'>
  marginBottom?: ResponsiveValue<SpacingToken | 'auto'>
  marginLeft?: ResponsiveValue<SpacingToken | 'auto'>
  marginHorizontal?: ResponsiveValue<SpacingToken | 'auto'>
  marginVertical?: ResponsiveValue<SpacingToken | 'auto'>
  m?: ResponsiveValue<SpacingToken | 'auto'>
  mt?: ResponsiveValue<SpacingToken | 'auto'>
  mr?: ResponsiveValue<SpacingToken | 'auto'>
  mb?: ResponsiveValue<SpacingToken | 'auto'>
  ml?: ResponsiveValue<SpacingToken | 'auto'>
  mx?: ResponsiveValue<SpacingToken | 'auto'>
  my?: ResponsiveValue<SpacingToken | 'auto'>

  gap?: ResponsiveValue<PositiveSpacingToken>
  rowGap?: ResponsiveValue<PositiveSpacingToken>
  columnGap?: ResponsiveValue<PositiveSpacingToken>
  g?: ResponsiveValue<PositiveSpacingToken>
}

export interface ColorProps {
  backgroundColor?: ResponsiveValue<BackgroundColorToken>
  color?: ResponsiveValue<TextColorToken>
  borderColor?: ResponsiveValue<BorderColorToken>
}

export interface BorderProps {
  borderRadius?: ResponsiveValue<BorderRadiusToken>
  borderTopLeftRadius?: ResponsiveValue<BorderRadiusToken>
  borderTopRightRadius?: ResponsiveValue<BorderRadiusToken>
  borderBottomLeftRadius?: ResponsiveValue<BorderRadiusToken>
  borderBottomRightRadius?: ResponsiveValue<BorderRadiusToken>
  borderWidth?: ResponsiveValue<number>
  borderTopWidth?: ResponsiveValue<number>
  borderRightWidth?: ResponsiveValue<number>
  borderBottomWidth?: ResponsiveValue<number>
  borderLeftWidth?: ResponsiveValue<number>
  borderStyle?: ResponsiveValue<'solid' | 'dashed' | 'dotted' | 'none'>
}

export interface ShadowProps {
  boxShadow?: ResponsiveValue<ShadowToken>
}

export interface LayoutProps {
  display?: ResponsiveValue<
    | 'flex'
    | 'grid'
    | 'block'
    | 'inline'
    | 'inline-flex'
    | 'inline-grid'
    | 'inline-block'
    | 'none'
    | 'contents'
  >
  overflow?: ResponsiveValue<'hidden' | 'auto' | 'scroll' | 'visible'>
  overflowX?: ResponsiveValue<'hidden' | 'auto' | 'scroll' | 'visible'>
  overflowY?: ResponsiveValue<'hidden' | 'auto' | 'scroll' | 'visible'>
  width?: ResponsiveValue<string | number>
  height?: ResponsiveValue<string | number>
  minWidth?: ResponsiveValue<string | number>
  maxWidth?: ResponsiveValue<string | number>
  minHeight?: ResponsiveValue<string | number>
  maxHeight?: ResponsiveValue<string | number>
  aspectRatio?: ResponsiveValue<string>
}

export interface FlexProps {
  flex?: ResponsiveValue<number | string>
  flexDirection?: ResponsiveValue<
    'row' | 'column' | 'row-reverse' | 'column-reverse'
  >
  flexWrap?: ResponsiveValue<'wrap' | 'nowrap' | 'wrap-reverse'>
  flexGrow?: ResponsiveValue<number>
  flexShrink?: ResponsiveValue<number>
  flexBasis?: ResponsiveValue<string | number>
  alignItems?: ResponsiveValue<
    'start' | 'end' | 'center' | 'baseline' | 'stretch'
  >
  alignSelf?: ResponsiveValue<
    'start' | 'end' | 'center' | 'baseline' | 'stretch' | 'auto'
  >
  justifyContent?: ResponsiveValue<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
  >
  alignContent?: ResponsiveValue<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'stretch'
  >
}

export interface GridProps {
  gridTemplateColumns?: ResponsiveValue<string>
  gridTemplateRows?: ResponsiveValue<string>
  gridTemplateAreas?: ResponsiveValue<string>
  gridColumn?: ResponsiveValue<string | number>
  gridRow?: ResponsiveValue<string | number>
  gridArea?: ResponsiveValue<string>
  gridColumnStart?: ResponsiveValue<number | string>
  gridColumnEnd?: ResponsiveValue<number | string>
  gridRowStart?: ResponsiveValue<number | string>
  gridRowEnd?: ResponsiveValue<number | string>
  gridAutoFlow?: ResponsiveValue<
    'row' | 'column' | 'dense' | 'row-dense' | 'column-dense'
  >
  gridAutoColumns?: ResponsiveValue<string>
  gridAutoRows?: ResponsiveValue<string>
}

export interface PositionProps {
  position?: ResponsiveValue<
    'relative' | 'absolute' | 'fixed' | 'sticky' | 'static'
  >
  top?: ResponsiveValue<OffsetValue>
  right?: ResponsiveValue<OffsetValue>
  bottom?: ResponsiveValue<OffsetValue>
  left?: ResponsiveValue<OffsetValue>
  inset?: ResponsiveValue<OffsetValue>
  zIndex?: ResponsiveValue<number | string>
}

/**
 * Curated `transition-property` presets. Keyword values expand to a real
 * property list so authors don't hand-write CSS — `colors` is the common case
 * for token-driven hover states, `common` covers most interactive surfaces.
 */
export type TransitionProperty =
  | 'none'
  | 'all'
  | 'common'
  | 'colors'
  | 'opacity'
  | 'shadow'
  | 'transform'

export interface MotionProps {
  transitionProperty?: ResponsiveValue<TransitionProperty>
  transitionDuration?: ResponsiveValue<DurationToken>
  transitionTimingFunction?: ResponsiveValue<EasingToken>
  /** Alias for `transitionTimingFunction`. */
  ease?: ResponsiveValue<EasingToken>
  transitionDelay?: ResponsiveValue<DurationToken>
  transform?: ResponsiveValue<string>
  transformOrigin?: ResponsiveValue<string>
  willChange?: ResponsiveValue<string>
}

export interface VisualProps {
  opacity?: ResponsiveValue<number>
  cursor?: ResponsiveValue<
    | 'pointer'
    | 'default'
    | 'not-allowed'
    | 'grab'
    | 'grabbing'
    | 'text'
    | 'move'
    | 'wait'
  >
  pointerEvents?: ResponsiveValue<'none' | 'auto'>
  visibility?: ResponsiveValue<'visible' | 'hidden'>
  userSelect?: ResponsiveValue<'none' | 'text' | 'all' | 'auto'>
  textAlign?: ResponsiveValue<'left' | 'center' | 'right' | 'justify'>
}

export type BoxStyleProps = SpacingProps &
  ColorProps &
  BorderProps &
  ShadowProps &
  LayoutProps &
  FlexProps &
  GridProps &
  PositionProps &
  MotionProps &
  VisualProps
