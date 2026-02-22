import type { FlexProps, ThemeSpec, TokenProps } from './createBox'

// ─── Flex class maps ──────────────────────────────────────────────────────────
// Fully static strings — Tailwind JIT can scan these as literals.

const DISPLAY: Record<NonNullable<FlexProps['display']>, string> = {
  flex: 'flex',
  block: 'block',
  'inline-flex': 'inline-flex',
  grid: 'grid',
  'inline-grid': 'inline-grid',
  hidden: 'hidden',
}

const FLEX_DIRECTION: Record<NonNullable<FlexProps['flexDirection']>, string> = {
  row: 'flex-row',
  column: 'flex-col',
  'row-reverse': 'flex-row-reverse',
  'column-reverse': 'flex-col-reverse',
}

const ALIGN_ITEMS: Record<NonNullable<FlexProps['alignItems']>, string> = {
  start: 'items-start',
  end: 'items-end',
  center: 'items-center',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}

const JUSTIFY_CONTENT: Record<NonNullable<FlexProps['justifyContent']>, string> = {
  start: 'justify-start',
  end: 'justify-end',
  center: 'justify-center',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
}

const FLEX_WRAP: Record<NonNullable<FlexProps['flexWrap']>, string> = {
  wrap: 'flex-wrap',
  nowrap: 'flex-nowrap',
  'wrap-reverse': 'flex-wrap-reverse',
}

const FLEX: Record<NonNullable<FlexProps['flex']>, string> = {
  '1': 'flex-1',
  auto: 'flex-auto',
  none: 'flex-none',
  initial: 'flex-initial',
}

// ─── resolveProperties ───────────────────────────────────────────────────────

export function resolveProperties<T extends ThemeSpec>(
  theme: T,
  props: TokenProps<T> & FlexProps,
): string {
  const classes: string[] = []

  const c = theme.colors
  const sp = (k: keyof T['spacing']) => theme.spacing[k as string | number]
  const r = (k: keyof T['radii']) => theme.radii[k as string]

  // ── Colors
  if (props.backgroundColor !== undefined) {
    const cls = c[props.backgroundColor as string]?.background
    if (cls !== undefined) classes.push(cls)
  }
  if (props.color !== undefined) {
    const cls = c[props.color as string]?.text
    if (cls !== undefined) classes.push(cls)
  }
  if (props.borderColor !== undefined) {
    const cls = c[props.borderColor as string]?.border
    if (cls !== undefined) classes.push(cls)
  }

  // ── Spacing
  if (props.padding !== undefined) classes.push(sp(props.padding).padding)
  if (props.paddingX !== undefined) classes.push(sp(props.paddingX).paddingX)
  if (props.paddingY !== undefined) classes.push(sp(props.paddingY).paddingY)
  if (props.paddingTop !== undefined) classes.push(sp(props.paddingTop).paddingTop)
  if (props.paddingRight !== undefined) classes.push(sp(props.paddingRight).paddingRight)
  if (props.paddingBottom !== undefined) classes.push(sp(props.paddingBottom).paddingBottom)
  if (props.paddingLeft !== undefined) classes.push(sp(props.paddingLeft).paddingLeft)

  if (props.margin !== undefined) classes.push(sp(props.margin).margin)
  if (props.marginX !== undefined) classes.push(sp(props.marginX).marginX)
  if (props.marginY !== undefined) classes.push(sp(props.marginY).marginY)
  if (props.marginTop !== undefined) classes.push(sp(props.marginTop).marginTop)
  if (props.marginRight !== undefined) classes.push(sp(props.marginRight).marginRight)
  if (props.marginBottom !== undefined) classes.push(sp(props.marginBottom).marginBottom)
  if (props.marginLeft !== undefined) classes.push(sp(props.marginLeft).marginLeft)

  if (props.gap !== undefined) classes.push(sp(props.gap).gap)
  if (props.rowGap !== undefined) classes.push(sp(props.rowGap).rowGap)
  if (props.columnGap !== undefined) classes.push(sp(props.columnGap).columnGap)

  // ── Radii
  if (props.borderRadius !== undefined) classes.push(r(props.borderRadius).all)
  if (props.borderTopLeftRadius !== undefined) classes.push(r(props.borderTopLeftRadius).tl)
  if (props.borderTopRightRadius !== undefined) classes.push(r(props.borderTopRightRadius).tr)
  if (props.borderBottomLeftRadius !== undefined) classes.push(r(props.borderBottomLeftRadius).bl)
  if (props.borderBottomRightRadius !== undefined) classes.push(r(props.borderBottomRightRadius).br)

  // ── Flex
  if (props.display !== undefined) classes.push(DISPLAY[props.display])
  if (props.flexDirection !== undefined) classes.push(FLEX_DIRECTION[props.flexDirection])
  if (props.alignItems !== undefined) classes.push(ALIGN_ITEMS[props.alignItems])
  if (props.justifyContent !== undefined) classes.push(JUSTIFY_CONTENT[props.justifyContent])
  if (props.flexWrap !== undefined) classes.push(FLEX_WRAP[props.flexWrap])
  if (props.flex !== undefined) classes.push(FLEX[props.flex])

  return classes.join(' ')
}
