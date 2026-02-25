import React, {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
  type ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveFlexChildClasses } from './resolveProperties'
import type { Color, Radius, Spacing } from './theme'

// ─── Breakpoint support ───────────────────────────────────────────────────────
// Each flex prop can be a plain value or a breakpoint map { default: ..., xl: ... }.
// "default" maps to no prefix; all other breakpoints get a Tailwind prefix.

export type Breakpoint = 'default' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type Responsive<T> = T | Partial<Record<Breakpoint, T>>

// ─── Flex container props ─────────────────────────────────────────────────────
// Used by Stack — NOT on Box. Box is not a flex container.

export type FlexContainerProps = {
  display?: Responsive<
    'flex' | 'block' | 'inline-flex' | 'grid' | 'inline-grid' | 'hidden'
  >
  flexDirection?: Responsive<
    'row' | 'column' | 'row-reverse' | 'column-reverse'
  >
  alignItems?: Responsive<'start' | 'end' | 'center' | 'stretch' | 'baseline'>
  justifyContent?: Responsive<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
  >
  flexWrap?: Responsive<'wrap' | 'nowrap' | 'wrap-reverse'>
}

// ─── Flex child props ─────────────────────────────────────────────────────────
// Used by Box — props that are useful when Box is a child inside a flex/grid layout.

export type FlexChildProps = {
  /** flex shorthand — e.g. flex="1" to fill remaining space. */
  flex?: Responsive<'1' | 'auto' | 'none' | 'initial'>
  /** align-self override for this specific flex/grid child. */
  alignSelf?: Responsive<
    'auto' | 'start' | 'end' | 'center' | 'stretch' | 'baseline'
  >
  /** flex-grow: 0 (default) | 1 (grow to fill). */
  flexGrow?: '0' | '1'
  /** flex-shrink: 0 (don't shrink) | 1 (default). */
  flexShrink?: '0' | '1'
}

// ─── Style props (CSS values applied as inline styles) ────────────────────────
// Values are any valid CSS value strings, typically CSS variable references
// from useOrbit() — e.g. "var(--SPACING_3)", "var(--CARD-BACKGROUND)".

export type BoxStyleProps = {
  backgroundColor?: Color
  color?: Color
  borderColor?: Color
  padding?: Spacing
  paddingX?: Spacing
  paddingY?: Spacing
  paddingTop?: Spacing
  paddingRight?: Spacing
  paddingBottom?: Spacing
  paddingLeft?: Spacing
  margin?: Spacing
  marginX?: Spacing
  marginY?: Spacing
  marginTop?: Spacing
  marginRight?: Spacing
  marginBottom?: Spacing
  marginLeft?: Spacing
  gap?: Spacing
  rowGap?: Spacing
  columnGap?: Spacing
  borderRadius?: Radius
  borderTopLeftRadius?: Radius
  borderTopRightRadius?: Radius
  borderBottomLeftRadius?: Radius
  borderBottomRightRadius?: Radius
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

    const flexClasses = resolveFlexChildClasses({
      flex,
      alignSelf,
      flexGrow,
      flexShrink,
    })

    return (
      <Tag className={twMerge(flexClasses, className)} {...rest}>
        {children}
      </Tag>
    )
  }

  Box.displayName = 'Box'
  return Box
}
