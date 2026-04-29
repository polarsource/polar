import * as stylex from '@stylexjs/stylex'
import { borderRadii, colors, shadows, spacing } from '../tokens/tokens.stylex'

/*
  This is where we connect each prop to the corresponding CSS property from our design tokens.
  There is a lot of repetition here, multiple styles using the same properties. This is however due to
  the nature of how StyleX works. We can't use dynamic properties.
*/

// ── Spacing ──────────────────────────────────────────────────────────────────

export const paddingStyles = stylex.create({
  none: { padding: spacing.none },
  xs: { padding: spacing.xs },
  s: { padding: spacing.s },
  m: { padding: spacing.m },
  l: { padding: spacing.l },
  xl: { padding: spacing.xl },
  '2xl': { padding: spacing['2xl'] },
  '3xl': { padding: spacing['3xl'] },
  '4xl': { padding: spacing['4xl'] },
  '5xl': { padding: spacing['5xl'] },
})

export const paddingTopStyles = stylex.create({
  none: { paddingTop: spacing.none },
  xs: { paddingTop: spacing.xs },
  s: { paddingTop: spacing.s },
  m: { paddingTop: spacing.m },
  l: { paddingTop: spacing.l },
  xl: { paddingTop: spacing.xl },
  '2xl': { paddingTop: spacing['2xl'] },
  '3xl': { paddingTop: spacing['3xl'] },
  '4xl': { paddingTop: spacing['4xl'] },
  '5xl': { paddingTop: spacing['5xl'] },
})

export const paddingRightStyles = stylex.create({
  none: { paddingRight: spacing.none },
  xs: { paddingRight: spacing.xs },
  s: { paddingRight: spacing.s },
  m: { paddingRight: spacing.m },
  l: { paddingRight: spacing.l },
  xl: { paddingRight: spacing.xl },
  '2xl': { paddingRight: spacing['2xl'] },
  '3xl': { paddingRight: spacing['3xl'] },
  '4xl': { paddingRight: spacing['4xl'] },
  '5xl': { paddingRight: spacing['5xl'] },
})

export const paddingBottomStyles = stylex.create({
  none: { paddingBottom: spacing.none },
  xs: { paddingBottom: spacing.xs },
  s: { paddingBottom: spacing.s },
  m: { paddingBottom: spacing.m },
  l: { paddingBottom: spacing.l },
  xl: { paddingBottom: spacing.xl },
  '2xl': { paddingBottom: spacing['2xl'] },
  '3xl': { paddingBottom: spacing['3xl'] },
  '4xl': { paddingBottom: spacing['4xl'] },
  '5xl': { paddingBottom: spacing['5xl'] },
})

export const paddingLeftStyles = stylex.create({
  none: { paddingLeft: spacing.none },
  xs: { paddingLeft: spacing.xs },
  s: { paddingLeft: spacing.s },
  m: { paddingLeft: spacing.m },
  l: { paddingLeft: spacing.l },
  xl: { paddingLeft: spacing.xl },
  '2xl': { paddingLeft: spacing['2xl'] },
  '3xl': { paddingLeft: spacing['3xl'] },
  '4xl': { paddingLeft: spacing['4xl'] },
  '5xl': { paddingLeft: spacing['5xl'] },
})

export const paddingInlineStyles = stylex.create({
  none: { paddingInline: spacing.none },
  xs: { paddingInline: spacing.xs },
  s: { paddingInline: spacing.s },
  m: { paddingInline: spacing.m },
  l: { paddingInline: spacing.l },
  xl: { paddingInline: spacing.xl },
  '2xl': { paddingInline: spacing['2xl'] },
  '3xl': { paddingInline: spacing['3xl'] },
  '4xl': { paddingInline: spacing['4xl'] },
  '5xl': { paddingInline: spacing['5xl'] },
})

export const paddingBlockStyles = stylex.create({
  none: { paddingBlock: spacing.none },
  xs: { paddingBlock: spacing.xs },
  s: { paddingBlock: spacing.s },
  m: { paddingBlock: spacing.m },
  l: { paddingBlock: spacing.l },
  xl: { paddingBlock: spacing.xl },
  '2xl': { paddingBlock: spacing['2xl'] },
  '3xl': { paddingBlock: spacing['3xl'] },
  '4xl': { paddingBlock: spacing['4xl'] },
  '5xl': { paddingBlock: spacing['5xl'] },
})

export const marginStyles = stylex.create({
  none: { margin: spacing.none },
  xs: { margin: spacing.xs },
  s: { margin: spacing.s },
  m: { margin: spacing.m },
  l: { margin: spacing.l },
  xl: { margin: spacing.xl },
  '2xl': { margin: spacing['2xl'] },
  '3xl': { margin: spacing['3xl'] },
  '4xl': { margin: spacing['4xl'] },
  '5xl': { margin: spacing['5xl'] },
  auto: { margin: 'auto' },
})

export const marginTopStyles = stylex.create({
  none: { marginTop: spacing.none },
  xs: { marginTop: spacing.xs },
  s: { marginTop: spacing.s },
  m: { marginTop: spacing.m },
  l: { marginTop: spacing.l },
  xl: { marginTop: spacing.xl },
  '2xl': { marginTop: spacing['2xl'] },
  '3xl': { marginTop: spacing['3xl'] },
  '4xl': { marginTop: spacing['4xl'] },
  '5xl': { marginTop: spacing['5xl'] },
  auto: { marginTop: 'auto' },
})

export const marginRightStyles = stylex.create({
  none: { marginRight: spacing.none },
  xs: { marginRight: spacing.xs },
  s: { marginRight: spacing.s },
  m: { marginRight: spacing.m },
  l: { marginRight: spacing.l },
  xl: { marginRight: spacing.xl },
  '2xl': { marginRight: spacing['2xl'] },
  '3xl': { marginRight: spacing['3xl'] },
  '4xl': { marginRight: spacing['4xl'] },
  '5xl': { marginRight: spacing['5xl'] },
  auto: { marginRight: 'auto' },
})

export const marginBottomStyles = stylex.create({
  none: { marginBottom: spacing.none },
  xs: { marginBottom: spacing.xs },
  s: { marginBottom: spacing.s },
  m: { marginBottom: spacing.m },
  l: { marginBottom: spacing.l },
  xl: { marginBottom: spacing.xl },
  '2xl': { marginBottom: spacing['2xl'] },
  '3xl': { marginBottom: spacing['3xl'] },
  '4xl': { marginBottom: spacing['4xl'] },
  '5xl': { marginBottom: spacing['5xl'] },
  auto: { marginBottom: 'auto' },
})

export const marginLeftStyles = stylex.create({
  none: { marginLeft: spacing.none },
  xs: { marginLeft: spacing.xs },
  s: { marginLeft: spacing.s },
  m: { marginLeft: spacing.m },
  l: { marginLeft: spacing.l },
  xl: { marginLeft: spacing.xl },
  '2xl': { marginLeft: spacing['2xl'] },
  '3xl': { marginLeft: spacing['3xl'] },
  '4xl': { marginLeft: spacing['4xl'] },
  '5xl': { marginLeft: spacing['5xl'] },
  auto: { marginLeft: 'auto' },
})

export const marginInlineStyles = stylex.create({
  none: { marginInline: spacing.none },
  xs: { marginInline: spacing.xs },
  s: { marginInline: spacing.s },
  m: { marginInline: spacing.m },
  l: { marginInline: spacing.l },
  xl: { marginInline: spacing.xl },
  '2xl': { marginInline: spacing['2xl'] },
  '3xl': { marginInline: spacing['3xl'] },
  '4xl': { marginInline: spacing['4xl'] },
  '5xl': { marginInline: spacing['5xl'] },
  auto: { marginInline: 'auto' },
})

export const marginBlockStyles = stylex.create({
  none: { marginBlock: spacing.none },
  xs: { marginBlock: spacing.xs },
  s: { marginBlock: spacing.s },
  m: { marginBlock: spacing.m },
  l: { marginBlock: spacing.l },
  xl: { marginBlock: spacing.xl },
  '2xl': { marginBlock: spacing['2xl'] },
  '3xl': { marginBlock: spacing['3xl'] },
  '4xl': { marginBlock: spacing['4xl'] },
  '5xl': { marginBlock: spacing['5xl'] },
  auto: { marginBlock: 'auto' },
})

export const gapStyles = stylex.create({
  none: { gap: spacing.none },
  xs: { gap: spacing.xs },
  s: { gap: spacing.s },
  m: { gap: spacing.m },
  l: { gap: spacing.l },
  xl: { gap: spacing.xl },
  '2xl': { gap: spacing['2xl'] },
  '3xl': { gap: spacing['3xl'] },
  '4xl': { gap: spacing['4xl'] },
  '5xl': { gap: spacing['5xl'] },
})

export const rowGapStyles = stylex.create({
  none: { rowGap: spacing.none },
  xs: { rowGap: spacing.xs },
  s: { rowGap: spacing.s },
  m: { rowGap: spacing.m },
  l: { rowGap: spacing.l },
  xl: { rowGap: spacing.xl },
  '2xl': { rowGap: spacing['2xl'] },
  '3xl': { rowGap: spacing['3xl'] },
  '4xl': { rowGap: spacing['4xl'] },
  '5xl': { rowGap: spacing['5xl'] },
})

export const columnGapStyles = stylex.create({
  none: { columnGap: spacing.none },
  xs: { columnGap: spacing.xs },
  s: { columnGap: spacing.s },
  m: { columnGap: spacing.m },
  l: { columnGap: spacing.l },
  xl: { columnGap: spacing.xl },
  '2xl': { columnGap: spacing['2xl'] },
  '3xl': { columnGap: spacing['3xl'] },
  '4xl': { columnGap: spacing['4xl'] },
  '5xl': { columnGap: spacing['5xl'] },
})

// ── Colors ───────────────────────────────────────────────────────────────────

export const backgroundColorStyles = stylex.create({
  'background-primary': { backgroundColor: colors['background-primary'] },
  'background-secondary': { backgroundColor: colors['background-secondary'] },
  'background-card': { backgroundColor: colors['background-card'] },
  'background-warning': { backgroundColor: colors['background-warning'] },
  'background-success': { backgroundColor: colors['background-success'] },
  'background-danger': { backgroundColor: colors['background-danger'] },
  'background-pending': { backgroundColor: colors['background-pending'] },
  'text-primary': { backgroundColor: colors['text-primary'] },
  'text-secondary': { backgroundColor: colors['text-secondary'] },
  'text-tertiary': { backgroundColor: colors['text-tertiary'] },
  'text-success': { backgroundColor: colors['text-success'] },
  'text-danger': { backgroundColor: colors['text-danger'] },
  'text-warning': { backgroundColor: colors['text-warning'] },
  'text-pending': { backgroundColor: colors['text-pending'] },
  'border-primary': { backgroundColor: colors['border-primary'] },
  'border-secondary': { backgroundColor: colors['border-secondary'] },
  'border-warning': { backgroundColor: colors['border-warning'] },
})

export const colorStyles = stylex.create({
  'background-primary': { color: colors['background-primary'] },
  'background-secondary': { color: colors['background-secondary'] },
  'background-card': { color: colors['background-card'] },
  'background-warning': { color: colors['background-warning'] },
  'background-success': { color: colors['background-success'] },
  'background-danger': { color: colors['background-danger'] },
  'background-pending': { color: colors['background-pending'] },
  'text-primary': { color: colors['text-primary'] },
  'text-secondary': { color: colors['text-secondary'] },
  'text-tertiary': { color: colors['text-tertiary'] },
  'text-success': { color: colors['text-success'] },
  'text-danger': { color: colors['text-danger'] },
  'text-warning': { color: colors['text-warning'] },
  'text-pending': { color: colors['text-pending'] },
  'border-primary': { color: colors['border-primary'] },
  'border-secondary': { color: colors['border-secondary'] },
  'border-warning': { color: colors['border-warning'] },
})

export const borderColorStyles = stylex.create({
  'background-primary': { borderColor: colors['background-primary'] },
  'background-secondary': { borderColor: colors['background-secondary'] },
  'background-card': { borderColor: colors['background-card'] },
  'background-warning': { borderColor: colors['background-warning'] },
  'background-success': { borderColor: colors['background-success'] },
  'background-danger': { borderColor: colors['background-danger'] },
  'background-pending': { borderColor: colors['background-pending'] },
  'text-primary': { borderColor: colors['text-primary'] },
  'text-secondary': { borderColor: colors['text-secondary'] },
  'text-tertiary': { borderColor: colors['text-tertiary'] },
  'text-success': { borderColor: colors['text-success'] },
  'text-danger': { borderColor: colors['text-danger'] },
  'text-warning': { borderColor: colors['text-warning'] },
  'text-pending': { borderColor: colors['text-pending'] },
  'border-primary': { borderColor: colors['border-primary'] },
  'border-secondary': { borderColor: colors['border-secondary'] },
  'border-warning': { borderColor: colors['border-warning'] },
})

// ── Border Radius ────────────────────────────────────────────────────────────

export const borderRadiusStyles = stylex.create({
  none: { borderRadius: borderRadii.none },
  s: { borderRadius: borderRadii.s },
  m: { borderRadius: borderRadii.m },
  l: { borderRadius: borderRadii.l },
  xl: { borderRadius: borderRadii.xl },
  full: { borderRadius: borderRadii.full },
})

export const borderTopLeftRadiusStyles = stylex.create({
  none: { borderTopLeftRadius: borderRadii.none },
  s: { borderTopLeftRadius: borderRadii.s },
  m: { borderTopLeftRadius: borderRadii.m },
  l: { borderTopLeftRadius: borderRadii.l },
  xl: { borderTopLeftRadius: borderRadii.xl },
  full: { borderTopLeftRadius: borderRadii.full },
})

export const borderTopRightRadiusStyles = stylex.create({
  none: { borderTopRightRadius: borderRadii.none },
  s: { borderTopRightRadius: borderRadii.s },
  m: { borderTopRightRadius: borderRadii.m },
  l: { borderTopRightRadius: borderRadii.l },
  xl: { borderTopRightRadius: borderRadii.xl },
  full: { borderTopRightRadius: borderRadii.full },
})

export const borderBottomLeftRadiusStyles = stylex.create({
  none: { borderBottomLeftRadius: borderRadii.none },
  s: { borderBottomLeftRadius: borderRadii.s },
  m: { borderBottomLeftRadius: borderRadii.m },
  l: { borderBottomLeftRadius: borderRadii.l },
  xl: { borderBottomLeftRadius: borderRadii.xl },
  full: { borderBottomLeftRadius: borderRadii.full },
})

export const borderBottomRightRadiusStyles = stylex.create({
  none: { borderBottomRightRadius: borderRadii.none },
  s: { borderBottomRightRadius: borderRadii.s },
  m: { borderBottomRightRadius: borderRadii.m },
  l: { borderBottomRightRadius: borderRadii.l },
  xl: { borderBottomRightRadius: borderRadii.xl },
  full: { borderBottomRightRadius: borderRadii.full },
})

// ── Shadows ──────────────────────────────────────────────────────────────────

export const boxShadowStyles = stylex.create({
  none: { boxShadow: shadows.none },
  s: { boxShadow: shadows.s },
  m: { boxShadow: shadows.m },
  l: { boxShadow: shadows.l },
  xl: { boxShadow: shadows.xl },
})

// ── Display ──────────────────────────────────────────────────────────────────

export const displayStyles = stylex.create({
  flex: { display: 'flex' },
  grid: { display: 'grid' },
  block: { display: 'block' },
  inline: { display: 'inline' },
  'inline-flex': { display: 'inline-flex' },
  'inline-block': { display: 'inline-block' },
  none: { display: 'none' },
  contents: { display: 'contents' },
})

// ── Overflow ─────────────────────────────────────────────────────────────────

export const overflowStyles = stylex.create({
  hidden: { overflow: 'hidden' },
  auto: { overflow: 'auto' },
  scroll: { overflow: 'scroll' },
  visible: { overflow: 'visible' },
})

export const overflowXStyles = stylex.create({
  hidden: { overflowX: 'hidden' },
  auto: { overflowX: 'auto' },
  scroll: { overflowX: 'scroll' },
  visible: { overflowX: 'visible' },
})

export const overflowYStyles = stylex.create({
  hidden: { overflowY: 'hidden' },
  auto: { overflowY: 'auto' },
  scroll: { overflowY: 'scroll' },
  visible: { overflowY: 'visible' },
})

// ── Flex ─────────────────────────────────────────────────────────────────────

export const flexDirectionStyles = stylex.create({
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
  'row-reverse': { flexDirection: 'row-reverse' },
  'column-reverse': { flexDirection: 'column-reverse' },
})

export const flexWrapStyles = stylex.create({
  wrap: { flexWrap: 'wrap' },
  nowrap: { flexWrap: 'nowrap' },
  'wrap-reverse': { flexWrap: 'wrap-reverse' },
})

export const alignItemsStyles = stylex.create({
  start: { alignItems: 'flex-start' },
  end: { alignItems: 'flex-end' },
  center: { alignItems: 'center' },
  baseline: { alignItems: 'baseline' },
  stretch: { alignItems: 'stretch' },
})

export const alignSelfStyles = stylex.create({
  start: { alignSelf: 'flex-start' },
  end: { alignSelf: 'flex-end' },
  center: { alignSelf: 'center' },
  baseline: { alignSelf: 'baseline' },
  stretch: { alignSelf: 'stretch' },
  auto: { alignSelf: 'auto' },
})

export const justifyContentStyles = stylex.create({
  start: { justifyContent: 'flex-start' },
  end: { justifyContent: 'flex-end' },
  center: { justifyContent: 'center' },
  between: { justifyContent: 'space-between' },
  around: { justifyContent: 'space-around' },
  evenly: { justifyContent: 'space-evenly' },
})

export const alignContentStyles = stylex.create({
  start: { alignContent: 'flex-start' },
  end: { alignContent: 'flex-end' },
  center: { alignContent: 'center' },
  between: { alignContent: 'space-between' },
  around: { alignContent: 'space-around' },
  evenly: { alignContent: 'space-evenly' },
  stretch: { alignContent: 'stretch' },
})

// ── Grid ─────────────────────────────────────────────────────────────────────

export const gridAutoFlowStyles = stylex.create({
  row: { gridAutoFlow: 'row' },
  column: { gridAutoFlow: 'column' },
  dense: { gridAutoFlow: 'dense' },
  'row-dense': { gridAutoFlow: 'row dense' },
  'column-dense': { gridAutoFlow: 'column dense' },
})

// ── Position ─────────────────────────────────────────────────────────────────

export const positionStyles = stylex.create({
  relative: { position: 'relative' },
  absolute: { position: 'absolute' },
  fixed: { position: 'fixed' },
  sticky: { position: 'sticky' },
  static: { position: 'static' },
})

// ── Border Style ─────────────────────────────────────────────────────────────

export const borderStyleStyles = stylex.create({
  solid: { borderStyle: 'solid' },
  dashed: { borderStyle: 'dashed' },
  dotted: { borderStyle: 'dotted' },
  none: { borderStyle: 'none' },
})

// ── Visual ───────────────────────────────────────────────────────────────────

export const cursorStyles = stylex.create({
  pointer: { cursor: 'pointer' },
  default: { cursor: 'default' },
  'not-allowed': { cursor: 'not-allowed' },
  grab: { cursor: 'grab' },
  grabbing: { cursor: 'grabbing' },
  text: { cursor: 'text' },
  move: { cursor: 'move' },
  wait: { cursor: 'wait' },
})

export const pointerEventsStyles = stylex.create({
  none: { pointerEvents: 'none' },
  auto: { pointerEvents: 'auto' },
})

export const visibilityStyles = stylex.create({
  visible: { visibility: 'visible' },
  hidden: { visibility: 'hidden' },
})

export const userSelectStyles = stylex.create({
  none: { userSelect: 'none' },
  text: { userSelect: 'text' },
  all: { userSelect: 'all' },
  auto: { userSelect: 'auto' },
})

// ── Text Align ──────────────────────────────────────────────────────────────

export const textAlignStyles = stylex.create({
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
  justify: { textAlign: 'justify' },
})
