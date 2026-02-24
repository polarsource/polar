import React, {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
  type ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveFlexChildClasses } from './resolveProperties'

// ─── Breakpoint support ───────────────────────────────────────────────────────
// Each flex prop can be a plain value or a breakpoint map { default: ..., xl: ... }.
// "default" maps to no prefix; all other breakpoints get a Tailwind prefix.

export type Breakpoint = 'default' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type Responsive<T> = T | Partial<Record<Breakpoint, T>>

// ─── Flex container props ─────────────────────────────────────────────────────
// Used by Stack — NOT on Box. Box is not a flex container.

export type FlexContainerProps = {
  display?: Responsive<'flex' | 'block' | 'inline-flex' | 'grid' | 'inline-grid' | 'hidden'>
  flexDirection?: Responsive<'row' | 'column' | 'row-reverse' | 'column-reverse'>
  alignItems?: Responsive<'start' | 'end' | 'center' | 'stretch' | 'baseline'>
  justifyContent?: Responsive<'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'>
  flexWrap?: Responsive<'wrap' | 'nowrap' | 'wrap-reverse'>
}

// ─── Flex child props ─────────────────────────────────────────────────────────
// Used by Box — props that are useful when Box is a child inside a flex/grid layout.

export type FlexChildProps = {
  /** flex shorthand — e.g. flex="1" to fill remaining space. */
  flex?: Responsive<'1' | 'auto' | 'none' | 'initial'>
  /** align-self override for this specific flex/grid child. */
  alignSelf?: Responsive<'auto' | 'start' | 'end' | 'center' | 'stretch' | 'baseline'>
  /** flex-grow: 0 (default) | 1 (grow to fill). */
  flexGrow?: '0' | '1'
  /** flex-shrink: 0 (don't shrink) | 1 (default). */
  flexShrink?: '0' | '1'
}

// ─── Style props (CSS values applied as inline styles) ────────────────────────
// Values are any valid CSS value strings, typically CSS variable references
// from useOrbit() — e.g. "var(--spacing-spacing-3)", "var(--card-background)".

export type BoxStyleProps = {
  backgroundColor?: string
  color?: string
  borderColor?: string
  padding?: string
  paddingX?: string
  paddingY?: string
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
  margin?: string
  marginX?: string
  marginY?: string
  marginTop?: string
  marginRight?: string
  marginBottom?: string
  marginLeft?: string
  gap?: string
  rowGap?: string
  columnGap?: string
  borderRadius?: string
  borderTopLeftRadius?: string
  borderTopRightRadius?: string
  borderBottomLeftRadius?: string
  borderBottomRightRadius?: string
}

// ─── Box props ────────────────────────────────────────────────────────────────

export type BoxProps<E extends ElementType = 'div'> = BoxStyleProps &
  FlexChildProps & {
    as?: E
    className?: string
    children?: ReactNode
  } & Omit<
    ComponentPropsWithoutRef<E>,
    keyof BoxStyleProps | keyof FlexChildProps | 'children' | 'className'
  >

// ─── createBox ────────────────────────────────────────────────────────────────

export function createBox() {
  function Box<E extends ElementType = 'div'>({
    as,
    className,
    children,
    // Style props — applied as inline styles
    backgroundColor,
    color,
    borderColor,
    padding,
    paddingX,
    paddingY,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    margin,
    marginX,
    marginY,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    gap,
    rowGap,
    columnGap,
    borderRadius,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderBottomLeftRadius,
    borderBottomRightRadius,
    // Flex child props — resolved to Tailwind classes
    flex,
    alignSelf,
    flexGrow,
    flexShrink,
    ...rest
  }: BoxProps<E>): JSX.Element {
    const Tag = (as ?? 'div') as ElementType

    const style: CSSProperties = {}
    if (backgroundColor !== undefined) style.backgroundColor = backgroundColor
    if (color !== undefined) style.color = color
    if (borderColor !== undefined) style.borderColor = borderColor
    if (padding !== undefined) style.padding = padding
    if (paddingX !== undefined) { style.paddingLeft = paddingX; style.paddingRight = paddingX }
    if (paddingY !== undefined) { style.paddingTop = paddingY; style.paddingBottom = paddingY }
    if (paddingTop !== undefined) style.paddingTop = paddingTop
    if (paddingRight !== undefined) style.paddingRight = paddingRight
    if (paddingBottom !== undefined) style.paddingBottom = paddingBottom
    if (paddingLeft !== undefined) style.paddingLeft = paddingLeft
    if (margin !== undefined) style.margin = margin
    if (marginX !== undefined) { style.marginLeft = marginX; style.marginRight = marginX }
    if (marginY !== undefined) { style.marginTop = marginY; style.marginBottom = marginY }
    if (marginTop !== undefined) style.marginTop = marginTop
    if (marginRight !== undefined) style.marginRight = marginRight
    if (marginBottom !== undefined) style.marginBottom = marginBottom
    if (marginLeft !== undefined) style.marginLeft = marginLeft
    if (gap !== undefined) style.gap = gap
    if (rowGap !== undefined) style.rowGap = rowGap
    if (columnGap !== undefined) style.columnGap = columnGap
    if (borderRadius !== undefined) style.borderRadius = borderRadius
    if (borderTopLeftRadius !== undefined) style.borderTopLeftRadius = borderTopLeftRadius
    if (borderTopRightRadius !== undefined) style.borderTopRightRadius = borderTopRightRadius
    if (borderBottomLeftRadius !== undefined) style.borderBottomLeftRadius = borderBottomLeftRadius
    if (borderBottomRightRadius !== undefined) style.borderBottomRightRadius = borderBottomRightRadius

    const flexClasses = resolveFlexChildClasses({ flex, alignSelf, flexGrow, flexShrink })

    return (
      <Tag
        className={twMerge(flexClasses, className)}
        style={Object.keys(style).length > 0 ? style : undefined}
        {...(rest as object)}
      >
        {children}
      </Tag>
    )
  }

  Box.displayName = 'Box'
  return Box
}
