import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
  type ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveProperties } from './resolveProperties'

// ─── Theme Spec ──────────────────────────────────────────────────────────────

export type ThemeSpec = {
  colors: Record<string, string>
  spacing: Record<string | number, string | number>
  radii: Record<string, string | number>
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

type ColorProps<TColors extends Record<string, string>> = {
  backgroundColor?: keyof TColors
  color?: keyof TColors
  borderColor?: keyof TColors
}

type SpacingProps<TSpacing extends Record<string | number, string | number>> = {
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

type RadiiProps<TRadii extends Record<string, string | number>> = {
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

    // Extract token props to pass to resolveProperties, leaving native props in rest
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

    return (
      <Tag
        className={className ? twMerge(className) : undefined}
        style={resolveProperties(theme, tokenProps as TokenProps<T>)}
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
