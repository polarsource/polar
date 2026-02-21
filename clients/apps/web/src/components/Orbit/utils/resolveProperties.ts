import type { CSSProperties } from 'react'
import type { ThemeSpec, TokenProps } from './createBox'

export function resolveProperties<T extends ThemeSpec>(
  theme: T,
  props: TokenProps<T>,
): CSSProperties {
  const resolved: CSSProperties = {}

  const c = theme.colors
  const sp = (k: keyof T['spacing']): string | number => theme.spacing[k as string]
  const r = (k: keyof T['radii']): string | number => theme.radii[k as string]

  // ── Colors
  if (props.backgroundColor !== undefined) resolved.backgroundColor = c[props.backgroundColor as string]
  if (props.color !== undefined) resolved.color = c[props.color as string]
  if (props.borderColor !== undefined) resolved.borderColor = c[props.borderColor as string]

  // ── Spacing
  if (props.padding !== undefined) resolved.padding = sp(props.padding)
  if (props.paddingX !== undefined) {
    resolved.paddingLeft = sp(props.paddingX)
    resolved.paddingRight = sp(props.paddingX)
  }
  if (props.paddingY !== undefined) {
    resolved.paddingTop = sp(props.paddingY)
    resolved.paddingBottom = sp(props.paddingY)
  }
  if (props.paddingTop !== undefined) resolved.paddingTop = sp(props.paddingTop)
  if (props.paddingRight !== undefined) resolved.paddingRight = sp(props.paddingRight)
  if (props.paddingBottom !== undefined) resolved.paddingBottom = sp(props.paddingBottom)
  if (props.paddingLeft !== undefined) resolved.paddingLeft = sp(props.paddingLeft)

  if (props.margin !== undefined) resolved.margin = sp(props.margin)
  if (props.marginX !== undefined) {
    resolved.marginLeft = sp(props.marginX)
    resolved.marginRight = sp(props.marginX)
  }
  if (props.marginY !== undefined) {
    resolved.marginTop = sp(props.marginY)
    resolved.marginBottom = sp(props.marginY)
  }
  if (props.marginTop !== undefined) resolved.marginTop = sp(props.marginTop)
  if (props.marginRight !== undefined) resolved.marginRight = sp(props.marginRight)
  if (props.marginBottom !== undefined) resolved.marginBottom = sp(props.marginBottom)
  if (props.marginLeft !== undefined) resolved.marginLeft = sp(props.marginLeft)

  if (props.gap !== undefined) resolved.gap = sp(props.gap)
  if (props.rowGap !== undefined) resolved.rowGap = sp(props.rowGap)
  if (props.columnGap !== undefined) resolved.columnGap = sp(props.columnGap)

  // ── Radii
  if (props.borderRadius !== undefined) resolved.borderRadius = r(props.borderRadius)
  if (props.borderTopLeftRadius !== undefined) resolved.borderTopLeftRadius = r(props.borderTopLeftRadius)
  if (props.borderTopRightRadius !== undefined) resolved.borderTopRightRadius = r(props.borderTopRightRadius)
  if (props.borderBottomLeftRadius !== undefined) resolved.borderBottomLeftRadius = r(props.borderBottomLeftRadius)
  if (props.borderBottomRightRadius !== undefined) resolved.borderBottomRightRadius = r(props.borderBottomRightRadius)

  return resolved
}
