import React, {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
  type ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveProperties } from './resolveProperties'

// ─── Theme Spec ──────────────────────────────────────────────────────────────
// Each color token exposes three class strings — one per CSS usage.
// Each spacing token exposes one class string per spacing prop variant.
// Each radius token exposes one class string per corner variant.
// All strings must be fully static so Tailwind JIT can scan them.

export type ColorClasses = {
  background?: string
  text?: string
  border?: string
}

export type SpacingClasses = {
  padding: string
  paddingX: string
  paddingY: string
  paddingTop: string
  paddingRight: string
  paddingBottom: string
  paddingLeft: string
  margin: string
  marginX: string
  marginY: string
  marginTop: string
  marginRight: string
  marginBottom: string
  marginLeft: string
  gap: string
  rowGap: string
  columnGap: string
}

export type RadiusClasses = {
  all: string
  tl: string
  tr: string
  bl: string
  br: string
}

export type ThemeSpec = {
  colors: Record<string, ColorClasses>
  spacing: Record<string, SpacingClasses>
  radii: Record<string, RadiusClasses>
}

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

// ─── All Box prop names ───────────────────────────────────────────────────────
// Hardcoded so we can safely Omit them from native element props.

type BoxPropName =
  | 'backgroundColor'
  | 'color'
  | 'borderColor'
  | 'padding'
  | 'paddingX'
  | 'paddingY'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'margin'
  | 'marginX'
  | 'marginY'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'borderRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'flex'
  | 'alignSelf'
  | 'flexGrow'
  | 'flexShrink'

// ─── Per-category token prop types ───────────────────────────────────────────

type ColorProps<TColors extends Record<string, ColorClasses>> = {
  backgroundColor?: keyof TColors
  color?: keyof TColors
  borderColor?: keyof TColors
}

type SpacingProps<TSpacing extends Record<string, SpacingClasses>> = {
  padding?: keyof TSpacing
  paddingX?: keyof TSpacing
  paddingY?: keyof TSpacing
  paddingTop?: keyof TSpacing
  paddingRight?: keyof TSpacing
  paddingBottom?: keyof TSpacing
  paddingLeft?: keyof TSpacing
  margin?: keyof TSpacing
  marginX?: keyof TSpacing
  marginY?: keyof TSpacing
  marginTop?: keyof TSpacing
  marginRight?: keyof TSpacing
  marginBottom?: keyof TSpacing
  marginLeft?: keyof TSpacing
}

type RadiiProps<TRadii extends Record<string, RadiusClasses>> = {
  borderRadius?: keyof TRadii
  borderTopLeftRadius?: keyof TRadii
  borderTopRightRadius?: keyof TRadii
  borderBottomLeftRadius?: keyof TRadii
  borderBottomRightRadius?: keyof TRadii
}

type TokenProps<T extends ThemeSpec> = ColorProps<T['colors']> &
  SpacingProps<T['spacing']> &
  RadiiProps<T['radii']>

// ─── Box props ────────────────────────────────────────────────────────────────

type BoxProps<
  T extends ThemeSpec,
  E extends ElementType = 'div',
> = TokenProps<T> &
  FlexChildProps & {
    as?: E
    className?: string
    children?: ReactNode
  } & Omit<
    ComponentPropsWithoutRef<E>,
    BoxPropName | 'children' | 'style' | 'className'
  >

// ─── createBox ────────────────────────────────────────────────────────────────

export function createBox<T extends ThemeSpec>(theme: T) {
  function Box<E extends ElementType = 'div'>({
    as,
    className,
    children,
    ...props
  }: BoxProps<T, E>): JSX.Element {
    const Tag = (as ?? 'div') as ElementType
    const { ...rest } = props as Record<string, unknown>

    // Extract all Box-managed props, leaving native HTML props in rest
    const boxPropNames: BoxPropName[] = [
      'backgroundColor',
      'color',
      'borderColor',
      'padding',
      'paddingX',
      'paddingY',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'margin',
      'marginX',
      'marginY',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
      'borderRadius',
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomLeftRadius',
      'borderBottomRightRadius',
      'flex',
      'alignSelf',
      'flexGrow',
      'flexShrink',
    ]

    const boxProps: Record<string, unknown> = {}
    for (const key of boxPropNames) {
      if (key in rest) {
        boxProps[key] = rest[key]
        delete rest[key]
      }
    }

    const tokenClasses = resolveProperties(
      theme,
      boxProps as TokenProps<T> & FlexChildProps,
    )

    return (
      <Tag className={twMerge(tokenClasses, className)} {...(rest as object)}>
        {children}
      </Tag>
    )
  }

  Box.displayName = 'Box'
  return Box
}

// ─── Exported types ───────────────────────────────────────────────────────────

export type { BoxProps, TokenProps }
