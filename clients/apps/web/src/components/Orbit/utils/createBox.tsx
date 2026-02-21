import {
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
  background: string
  text: string
  border: string
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
  spacing: Record<string | number, SpacingClasses>
  radii: Record<string, RadiusClasses>
}

// ─── Token prop names ─────────────────────────────────────────────────────────
// Hardcoded so we can safely Omit them from native element props.

type TokenPropName =
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
  | 'gap'
  | 'rowGap'
  | 'columnGap'
  | 'borderRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'

// ─── Per-category token prop types ───────────────────────────────────────────

type ColorProps<TColors extends Record<string, ColorClasses>> = {
  backgroundColor?: keyof TColors
  color?: keyof TColors
  borderColor?: keyof TColors
}

type SpacingProps<TSpacing extends Record<string | number, SpacingClasses>> = {
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
  gap?: keyof TSpacing
  rowGap?: keyof TSpacing
  columnGap?: keyof TSpacing
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

type BoxProps<T extends ThemeSpec, E extends ElementType = 'div'> =
  TokenProps<T> & {
    as?: E
    className?: string
    children?: ReactNode
  } & Omit<
      ComponentPropsWithoutRef<E>,
      // Omit token props + style (disallowed) + native conflicts
      TokenPropName | 'children' | 'style' | 'className'
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

    // Extract token props, leaving native props in rest
    const tokenPropNames: TokenPropName[] = [
      'backgroundColor', 'color', 'borderColor',
      'padding', 'paddingX', 'paddingY', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'margin', 'marginX', 'marginY', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'gap', 'rowGap', 'columnGap',
      'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
    ]

    const tokenProps: Record<string, unknown> = {}
    for (const key of tokenPropNames) {
      if (key in rest) {
        tokenProps[key] = rest[key]
        delete rest[key]
      }
    }

    const tokenClasses = resolveProperties(theme, tokenProps as TokenProps<T>)

    return (
      <Tag
        className={twMerge(tokenClasses, className)}
        {...(rest as object)}
      >
        {children}
      </Tag>
    )
  }

  Box.displayName = 'Box'
  return Box
}

// ─── Exported types ───────────────────────────────────────────────────────────

export type { TokenProps, BoxProps }
