import type { ThemeSpec, TokenProps } from './createBox'

export function resolveProperties<T extends ThemeSpec>(
  theme: T,
  props: TokenProps<T>,
): string {
  const classes: string[] = []

  const c = theme.colors
  const sp = (k: keyof T['spacing']) => theme.spacing[k as string | number]
  const r = (k: keyof T['radii']) => theme.radii[k as string]

  // ── Colors
  if (props.backgroundColor !== undefined) classes.push(c[props.backgroundColor as string].background)
  if (props.color !== undefined) classes.push(c[props.color as string].text)
  if (props.borderColor !== undefined) classes.push(c[props.borderColor as string].border)

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

  return classes.join(' ')
}
