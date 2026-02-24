import React, { type ComponentPropsWithoutRef, type ElementType, type JSX } from 'react'
import { twMerge } from 'tailwind-merge'

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

const TRACKING: Record<NonNullable<TextStyleProps['tracking']>, string> = {
  tighter: 'tracking-tighter',
  tight: 'tracking-tight',
  normal: 'tracking-normal',
  wide: 'tracking-wide',
  wider: 'tracking-wider',
  widest: 'tracking-widest',
}

const TRANSFORM: Record<NonNullable<TextStyleProps['transform']>, string> = {
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
}

const FONT_FAMILY: Record<NonNullable<TextStyleProps['fontFamily']>, string> = {
  sans: 'font-sans',
  mono: 'font-mono',
}

// ─── Typography prop types ────────────────────────────────────────────────────

export type TextStyleProps = {
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl'
  fontWeight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  leading?: 'none' | 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose'
  tracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest'
  transform?: 'uppercase' | 'lowercase' | 'capitalize'
  fontFamily?: 'sans' | 'mono'
  tabular?: boolean
}

// ─── Variant ─────────────────────────────────────────────────────────────────

export type TextVariant = 'default' | 'subtle' | 'disabled'

// ─── Prop name union for native prop filtering ────────────────────────────────

type TextPropName =
  | 'fontSize'
  | 'fontWeight'
  | 'leading'
  | 'tracking'
  | 'transform'
  | 'fontFamily'
  | 'tabular'

// ─── createText ──────────────────────────────────────────────────────────────
// variantColors maps each TextVariant to a CSS value string (typically a
// CSS variable reference like "var(--COLOR_TEXT)").

export function createText(
  variantColors: Record<TextVariant, string>,
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
    tracking,
    transform,
    fontFamily,
    tabular,
    className,
    children,
    ...props
  }: TextProps<E>): JSX.Element {
    const Tag = (as ?? 'p') as ElementType

    const classes: string[] = []
    if (fontSize !== undefined) classes.push(FONT_SIZE[fontSize])
    if (fontWeight !== undefined) classes.push(FONT_WEIGHT[fontWeight])
    if (leading !== undefined) classes.push(LEADING[leading])
    if (tracking !== undefined) classes.push(TRACKING[tracking])
    if (transform !== undefined) classes.push(TRANSFORM[transform])
    if (fontFamily !== undefined) classes.push(FONT_FAMILY[fontFamily])
    if (tabular) classes.push('tabular-nums')

    return (
      <Tag
        className={twMerge(classes.join(' '), className)}
        style={{ color: variantColors[variant] }}
        {...(props as object)}
      >
        {children}
      </Tag>
    )
  }

  Text.displayName = 'Text'
  return Text
}
