import { cva, type VariantProps } from 'class-variance-authority'
import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
} from 'react'
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
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'

// ─── Variants ─────────────────────────────────────────────────────────────────
// All styling is encoded here — consumers pick a semantic variant, not raw props.

const HEADING_BASE = 'font-display tracking-tight text-black dark:text-white'

const textVariants = cva('', {
  variants: {
    variant: {
      /** Default body text — 14 px, normal weight, primary color. */
      body: 'text-sm leading-relaxed text-gray-900 dark:text-white',
      /** Form labels and table headers — 12 px, medium weight, primary color. */
      label: 'text-xs font-medium tracking-tight text-gray-900 dark:text-white',
      /** Supporting annotations — 12 px, subtle color. */
      caption: 'text-xs leading-snug text-gray-500 dark:text-polar-400',
      /** Secondary copy alongside primary content — 14 px, subtle color. */
      subtle: 'text-sm text-gray-500 dark:text-polar-400',
      /** Non-interactive or unavailable content — 14 px, disabled color. */
      disabled: 'text-sm text-gray-400 dark:text-polar-600',
      /** Inline code and technical values — monospace, 12 px. */
      mono: 'font-mono text-xs text-gray-900 dark:text-white',
      /** Page-level headline — h1 sizing. */
      'heading-xl': `${HEADING_BASE} text-5xl md:text-7xl font-light leading-tighter!`,
      /** Section headline — h2 sizing. */
      'heading-l': `${HEADING_BASE} text-4xl md:text-5xl leading-tight!`,
      /** Section headline — h3 sizing. */
      'heading-m': `${HEADING_BASE} text-3xl md:text-5xl leading-tight!`,
      /** Subsection headline — h4 sizing. */
      'heading-s': `${HEADING_BASE} text-2xl md:text-3xl leading-tight!`,
      /** Card/list headline — h5 sizing. */
      'heading-xs': `${HEADING_BASE} text-xl md:text-2xl leading-tight!`,
      /** Smallest headline — h6 sizing. */
      'heading-xxs': `${HEADING_BASE} text-lg md:text-xl leading-tight!`,
    },
    color: {
      /** Inherits color from variant (default behavior). */
      default: '',
      error: 'text-red-500 dark:text-red-500',
      warning: 'text-amber-500 dark:text-amber-500',
      success: 'text-emerald-500 dark:text-emerald-500',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
    },
    wrap: {
      wrap: 'text-wrap',
      nowrap: 'text-nowrap',
      balance: 'text-balance',
      pretty: 'text-pretty',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type TextVariant = NonNullable<
  VariantProps<typeof textVariants>['variant']
>
export type TextColor = NonNullable<VariantProps<typeof textVariants>['color']>
export type TextStyleProps = VariantProps<typeof textVariants>

type TextProps<E extends TextTag = 'p'> = TextStyleProps & {
  as?: E
  className?: string
} & Omit<ComponentPropsWithoutRef<E>, keyof TextStyleProps | 'className'>

// ─── Component ────────────────────────────────────────────────────────────────

const HEADING_FONT_FEATURES = "'ss07' 1, 'ss08' 1, 'zero' 1, 'liga' 0"

function Text<E extends TextTag = 'p'>({
  as,
  variant,
  color,
  align,
  wrap,
  className,
  children,
  style,
  ...props
}: TextProps<E> & { style?: React.CSSProperties }): JSX.Element {
  const Tag = (as ?? 'p') as ElementType
  const isHeading =
    typeof variant === 'string' && variant.startsWith('heading-')
  const mergedStyle = isHeading
    ? { fontFeatureSettings: HEADING_FONT_FEATURES, ...style }
    : style
  return (
    <Tag
      className={twMerge(
        textVariants({ variant, color, align, wrap }),
        className,
      )}
      style={mergedStyle}
      {...(props as object)}
    >
      {children}
    </Tag>
  )
}

Text.displayName = 'Text'

// ─── createText ───────────────────────────────────────────────────────────────
// Factory kept for extensibility — returns the standard Text component.

export function createText() {
  return Text
}

export { Text }
