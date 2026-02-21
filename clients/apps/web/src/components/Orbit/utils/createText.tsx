import type { ComponentPropsWithoutRef, ElementType, JSX } from 'react'
import { twMerge } from 'tailwind-merge'
import type { ThemeSpec } from './createBox'

// ─── Text tag union ───────────────────────────────────────────────────────────

type TextTag =
  | 'p'
  | 'span'
  | 'label'
  | 'strong'
  | 'em'
  | 'small'
  | 'code'
  | 'div'

// ─── Typography token maps ────────────────────────────────────────────────────
// Fully static strings — Tailwind JIT can scan these as literals.

const FONT_SIZE: Record<NonNullable<TextStyleProps['fontSize']>, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
}

const FONT_WEIGHT: Record<NonNullable<TextStyleProps['fontWeight']>, string> = {
  light: 'font-light',
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

const LEADING: Record<NonNullable<TextStyleProps['leading']>, string> = {
  none: 'leading-none',
  tight: 'leading-tight',
  snug: 'leading-snug',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
}

// ─── Typography prop types ────────────────────────────────────────────────────

export type TextStyleProps = {
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl'
  fontWeight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  leading?: 'none' | 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose'
}

// ─── Variant ─────────────────────────────────────────────────────────────────

export type TextVariant = 'default' | 'subtle' | 'disabled'

// ─── Prop name union for native prop filtering ────────────────────────────────

type TextPropName = 'fontSize' | 'fontWeight' | 'leading'

// ─── createText ──────────────────────────────────────────────────────────────

export function createText<T extends ThemeSpec>(
  theme: T,
  variantColors: Record<TextVariant, keyof T['colors']>,
) {
  type TextProps<E extends TextTag = 'p'> = {
    as?: E
    variant?: TextVariant
    className?: string
  } & TextStyleProps &
    Omit<ComponentPropsWithoutRef<E>, TextPropName | 'className'>

  function Text<E extends TextTag = 'p'>({
    as,
    variant = 'default',
    fontSize = 'lg',
    fontWeight,
    leading,
    className,
    children,
    ...props
  }: TextProps<E>): JSX.Element {
    const Tag = (as ?? 'p') as ElementType
    const colorKey = variantColors[variant] as string

    const classes: string[] = []
    const textColor = theme.colors[colorKey].text
    if (textColor !== undefined) classes.push(textColor)
    if (fontSize !== undefined) classes.push(FONT_SIZE[fontSize])
    if (fontWeight !== undefined) classes.push(FONT_WEIGHT[fontWeight])
    if (leading !== undefined) classes.push(LEADING[leading])

    return (
      <Tag
        className={twMerge(classes.join(' '), className)}
        {...(props as object)}
      >
        {children}
      </Tag>
    )
  }

  Text.displayName = 'Text'
  return Text
}
