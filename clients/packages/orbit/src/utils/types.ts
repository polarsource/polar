import type {
  BorderRadiusToken,
  BreakpointKey,
  ColorToken,
  ShadowToken,
  SpacingToken,
} from '../tokens/tokens.stylex'

export type PseudoState =
  | 'hover'
  | 'focus'
  | 'active'
  | 'focusVisible'
  | 'focusWithin'

export type ResponsiveValue<T> =
  | T
  | Partial<Record<'base' | BreakpointKey | PseudoState, T>>

export interface SpacingProps {
  padding?: ResponsiveValue<SpacingToken>
  paddingTop?: ResponsiveValue<SpacingToken>
  paddingRight?: ResponsiveValue<SpacingToken>
  paddingBottom?: ResponsiveValue<SpacingToken>
  paddingLeft?: ResponsiveValue<SpacingToken>
  paddingHorizontal?: ResponsiveValue<SpacingToken>
  paddingVertical?: ResponsiveValue<SpacingToken>
  p?: ResponsiveValue<SpacingToken>
  pt?: ResponsiveValue<SpacingToken>
  pr?: ResponsiveValue<SpacingToken>
  pb?: ResponsiveValue<SpacingToken>
  pl?: ResponsiveValue<SpacingToken>
  px?: ResponsiveValue<SpacingToken>
  py?: ResponsiveValue<SpacingToken>

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

  gap?: ResponsiveValue<SpacingToken>
  rowGap?: ResponsiveValue<SpacingToken>
  columnGap?: ResponsiveValue<SpacingToken>
  g?: ResponsiveValue<SpacingToken>
}

export interface ColorProps {
  backgroundColor?: ResponsiveValue<ColorToken>
  color?: ResponsiveValue<ColorToken>
  borderColor?: ResponsiveValue<ColorToken>
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
  gridColumn?: ResponsiveValue<string>
  gridRow?: ResponsiveValue<string>
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
  top?: ResponsiveValue<string | number>
  right?: ResponsiveValue<string | number>
  bottom?: ResponsiveValue<string | number>
  left?: ResponsiveValue<string | number>
  inset?: ResponsiveValue<string | number>
  zIndex?: ResponsiveValue<number | string>
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
  VisualProps
