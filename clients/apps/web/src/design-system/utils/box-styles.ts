import * as stylex from '@stylexjs/stylex'
import { borderRadii, colors, shadows, spacing } from '../tokens.stylex'

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
})

export const paddingTopStyles = stylex.create({
  none: { paddingTop: spacing.none },
  xs: { paddingTop: spacing.xs },
  s: { paddingTop: spacing.s },
  m: { paddingTop: spacing.m },
  l: { paddingTop: spacing.l },
  xl: { paddingTop: spacing.xl },
})

export const paddingRightStyles = stylex.create({
  none: { paddingRight: spacing.none },
  xs: { paddingRight: spacing.xs },
  s: { paddingRight: spacing.s },
  m: { paddingRight: spacing.m },
  l: { paddingRight: spacing.l },
  xl: { paddingRight: spacing.xl },
})

export const paddingBottomStyles = stylex.create({
  none: { paddingBottom: spacing.none },
  xs: { paddingBottom: spacing.xs },
  s: { paddingBottom: spacing.s },
  m: { paddingBottom: spacing.m },
  l: { paddingBottom: spacing.l },
  xl: { paddingBottom: spacing.xl },
})

export const paddingLeftStyles = stylex.create({
  none: { paddingLeft: spacing.none },
  xs: { paddingLeft: spacing.xs },
  s: { paddingLeft: spacing.s },
  m: { paddingLeft: spacing.m },
  l: { paddingLeft: spacing.l },
  xl: { paddingLeft: spacing.xl },
})

export const paddingInlineStyles = stylex.create({
  none: { paddingInline: spacing.none },
  xs: { paddingInline: spacing.xs },
  s: { paddingInline: spacing.s },
  m: { paddingInline: spacing.m },
  l: { paddingInline: spacing.l },
  xl: { paddingInline: spacing.xl },
})

export const paddingBlockStyles = stylex.create({
  none: { paddingBlock: spacing.none },
  xs: { paddingBlock: spacing.xs },
  s: { paddingBlock: spacing.s },
  m: { paddingBlock: spacing.m },
  l: { paddingBlock: spacing.l },
  xl: { paddingBlock: spacing.xl },
})

export const marginStyles = stylex.create({
  none: { margin: spacing.none },
  xs: { margin: spacing.xs },
  s: { margin: spacing.s },
  m: { margin: spacing.m },
  l: { margin: spacing.l },
  xl: { margin: spacing.xl },
})

export const marginTopStyles = stylex.create({
  none: { marginTop: spacing.none },
  xs: { marginTop: spacing.xs },
  s: { marginTop: spacing.s },
  m: { marginTop: spacing.m },
  l: { marginTop: spacing.l },
  xl: { marginTop: spacing.xl },
})

export const marginRightStyles = stylex.create({
  none: { marginRight: spacing.none },
  xs: { marginRight: spacing.xs },
  s: { marginRight: spacing.s },
  m: { marginRight: spacing.m },
  l: { marginRight: spacing.l },
  xl: { marginRight: spacing.xl },
})

export const marginBottomStyles = stylex.create({
  none: { marginBottom: spacing.none },
  xs: { marginBottom: spacing.xs },
  s: { marginBottom: spacing.s },
  m: { marginBottom: spacing.m },
  l: { marginBottom: spacing.l },
  xl: { marginBottom: spacing.xl },
})

export const marginLeftStyles = stylex.create({
  none: { marginLeft: spacing.none },
  xs: { marginLeft: spacing.xs },
  s: { marginLeft: spacing.s },
  m: { marginLeft: spacing.m },
  l: { marginLeft: spacing.l },
  xl: { marginLeft: spacing.xl },
})

export const marginInlineStyles = stylex.create({
  none: { marginInline: spacing.none },
  xs: { marginInline: spacing.xs },
  s: { marginInline: spacing.s },
  m: { marginInline: spacing.m },
  l: { marginInline: spacing.l },
  xl: { marginInline: spacing.xl },
})

export const marginBlockStyles = stylex.create({
  none: { marginBlock: spacing.none },
  xs: { marginBlock: spacing.xs },
  s: { marginBlock: spacing.s },
  m: { marginBlock: spacing.m },
  l: { marginBlock: spacing.l },
  xl: { marginBlock: spacing.xl },
})

export const gapStyles = stylex.create({
  none: { gap: spacing.none },
  xs: { gap: spacing.xs },
  s: { gap: spacing.s },
  m: { gap: spacing.m },
  l: { gap: spacing.l },
  xl: { gap: spacing.xl },
})

export const rowGapStyles = stylex.create({
  none: { rowGap: spacing.none },
  xs: { rowGap: spacing.xs },
  s: { rowGap: spacing.s },
  m: { rowGap: spacing.m },
  l: { rowGap: spacing.l },
  xl: { rowGap: spacing.xl },
})

export const columnGapStyles = stylex.create({
  none: { columnGap: spacing.none },
  xs: { columnGap: spacing.xs },
  s: { columnGap: spacing.s },
  m: { columnGap: spacing.m },
  l: { columnGap: spacing.l },
  xl: { columnGap: spacing.xl },
})

// ── Colors ───────────────────────────────────────────────────────────────────

export const backgroundColorStyles = stylex.create({
  'background-primary': { backgroundColor: colors['background-primary'] },
  'background-secondary': { backgroundColor: colors['background-secondary'] },
  'text-primary': { backgroundColor: colors['text-primary'] },
  'text-secondary': { backgroundColor: colors['text-secondary'] },
  'border-primary': { backgroundColor: colors['border-primary'] },
  'border-secondary': { backgroundColor: colors['border-secondary'] },
})

export const colorStyles = stylex.create({
  'background-primary': { color: colors['background-primary'] },
  'background-secondary': { color: colors['background-secondary'] },
  'text-primary': { color: colors['text-primary'] },
  'text-secondary': { color: colors['text-secondary'] },
  'border-primary': { color: colors['border-primary'] },
  'border-secondary': { color: colors['border-secondary'] },
})

export const borderColorStyles = stylex.create({
  'background-primary': { borderColor: colors['background-primary'] },
  'background-secondary': { borderColor: colors['background-secondary'] },
  'text-primary': { borderColor: colors['text-primary'] },
  'text-secondary': { borderColor: colors['text-secondary'] },
  'border-primary': { borderColor: colors['border-primary'] },
  'border-secondary': { borderColor: colors['border-secondary'] },
})

// ── Border Radius ────────────────────────────────────────────────────────────

export const borderRadiusStyles = stylex.create({
  none: { borderRadius: borderRadii.none },
  sm: { borderRadius: borderRadii.sm },
  md: { borderRadius: borderRadii.md },
  lg: { borderRadius: borderRadii.lg },
  xl: { borderRadius: borderRadii.xl },
  full: { borderRadius: borderRadii.full },
})

export const borderTopLeftRadiusStyles = stylex.create({
  none: { borderTopLeftRadius: borderRadii.none },
  sm: { borderTopLeftRadius: borderRadii.sm },
  md: { borderTopLeftRadius: borderRadii.md },
  lg: { borderTopLeftRadius: borderRadii.lg },
  xl: { borderTopLeftRadius: borderRadii.xl },
  full: { borderTopLeftRadius: borderRadii.full },
})

export const borderTopRightRadiusStyles = stylex.create({
  none: { borderTopRightRadius: borderRadii.none },
  sm: { borderTopRightRadius: borderRadii.sm },
  md: { borderTopRightRadius: borderRadii.md },
  lg: { borderTopRightRadius: borderRadii.lg },
  xl: { borderTopRightRadius: borderRadii.xl },
  full: { borderTopRightRadius: borderRadii.full },
})

export const borderBottomLeftRadiusStyles = stylex.create({
  none: { borderBottomLeftRadius: borderRadii.none },
  sm: { borderBottomLeftRadius: borderRadii.sm },
  md: { borderBottomLeftRadius: borderRadii.md },
  lg: { borderBottomLeftRadius: borderRadii.lg },
  xl: { borderBottomLeftRadius: borderRadii.xl },
  full: { borderBottomLeftRadius: borderRadii.full },
})

export const borderBottomRightRadiusStyles = stylex.create({
  none: { borderBottomRightRadius: borderRadii.none },
  sm: { borderBottomRightRadius: borderRadii.sm },
  md: { borderBottomRightRadius: borderRadii.md },
  lg: { borderBottomRightRadius: borderRadii.lg },
  xl: { borderBottomRightRadius: borderRadii.xl },
  full: { borderBottomRightRadius: borderRadii.full },
})

// ── Shadows ──────────────────────────────────────────────────────────────────

export const boxShadowStyles = stylex.create({
  none: { boxShadow: shadows.none },
  sm: { boxShadow: shadows.sm },
  md: { boxShadow: shadows.md },
  lg: { boxShadow: shadows.lg },
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
