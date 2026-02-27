import { cva, type VariantProps } from 'class-variance-authority'
import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
} from 'react'
import { twMerge } from 'tailwind-merge'
import {
  type Breakpoint,
  type Responsive,
  resolveFlexProp,
} from './resolveProperties'

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

// ─── Semantic variants (non-responsive) ───────────────────────────────────────

const textVariants = cva('', {
  variants: {
    variant: {
      /** Default body text — 14 px, normal weight, primary color. */
      body: 'text-sm leading-relaxed text-gray-900 dark:text-white',
      /** Form labels and table headers — 12 px, medium weight, primary color. */
      label: 'text-xs font-medium tracking-tight text-gray-900 dark:text-white',
      /** Supporting annotations — 12 px, subtle color. */
      caption: 'text-xs leading-snug text-gray-500 dark:text-polar-500',
      /** Secondary copy alongside primary content — 14 px, subtle color. */
      subtle: 'text-sm text-gray-500 dark:text-polar-500',
      /** Non-interactive or unavailable content — 14 px, disabled color. */
      disabled: 'text-sm text-gray-400 dark:text-polar-600',
      /** Inline code and technical values — monospace, 12 px. */
      mono: 'font-mono text-xs text-gray-900 dark:text-white',
    },
    color: {
      /** Inherits color from variant (default behavior). */
      default: '',
      error: 'text-red-500 dark:text-red-500',
      warning: 'text-amber-500 dark:text-amber-500',
      success: 'text-emerald-500 dark:text-emerald-500',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
})

// ─── Responsive prop types ────────────────────────────────────────────────────

export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type TextWrap = 'wrap' | 'nowrap' | 'balance' | 'pretty'
export type TextSize =
  | 'xs'
  | 'sm'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'

// ─── Lookup tables ────────────────────────────────────────────────────────────
// All class strings are static literals — Tailwind JIT can scan this file.

const TEXT_ALIGN: Record<Breakpoint, Record<TextAlign, string>> = {
  default: {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  },
  sm: {
    left: 'sm:text-left',
    center: 'sm:text-center',
    right: 'sm:text-right',
    justify: 'sm:text-justify',
  },
  md: {
    left: 'md:text-left',
    center: 'md:text-center',
    right: 'md:text-right',
    justify: 'md:text-justify',
  },
  lg: {
    left: 'lg:text-left',
    center: 'lg:text-center',
    right: 'lg:text-right',
    justify: 'lg:text-justify',
  },
  xl: {
    left: 'xl:text-left',
    center: 'xl:text-center',
    right: 'xl:text-right',
    justify: 'xl:text-justify',
  },
  '2xl': {
    left: '2xl:text-left',
    center: '2xl:text-center',
    right: '2xl:text-right',
    justify: '2xl:text-justify',
  },
} as const

const TEXT_WRAP: Record<Breakpoint, Record<TextWrap, string>> = {
  default: {
    wrap: 'text-wrap',
    nowrap: 'text-nowrap',
    balance: 'text-balance',
    pretty: 'text-pretty',
  },
  sm: {
    wrap: 'sm:text-wrap',
    nowrap: 'sm:text-nowrap',
    balance: 'sm:text-balance',
    pretty: 'sm:text-pretty',
  },
  md: {
    wrap: 'md:text-wrap',
    nowrap: 'md:text-nowrap',
    balance: 'md:text-balance',
    pretty: 'md:text-pretty',
  },
  lg: {
    wrap: 'lg:text-wrap',
    nowrap: 'lg:text-nowrap',
    balance: 'lg:text-balance',
    pretty: 'lg:text-pretty',
  },
  xl: {
    wrap: 'xl:text-wrap',
    nowrap: 'xl:text-nowrap',
    balance: 'xl:text-balance',
    pretty: 'xl:text-pretty',
  },
  '2xl': {
    wrap: '2xl:text-wrap',
    nowrap: '2xl:text-nowrap',
    balance: '2xl:text-balance',
    pretty: '2xl:text-pretty',
  },
} as const

const TEXT_SIZE: Record<Breakpoint, Record<TextSize, string>> = {
  default: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl',
    '6xl': 'text-6xl',
  },
  sm: {
    xs: 'sm:text-xs',
    sm: 'sm:text-sm',
    base: 'sm:text-base',
    lg: 'sm:text-lg',
    xl: 'sm:text-xl',
    '2xl': 'sm:text-2xl',
    '3xl': 'sm:text-3xl',
    '4xl': 'sm:text-4xl',
    '5xl': 'sm:text-5xl',
    '6xl': 'sm:text-6xl',
  },
  md: {
    xs: 'md:text-xs',
    sm: 'md:text-sm',
    base: 'md:text-base',
    lg: 'md:text-lg',
    xl: 'md:text-xl',
    '2xl': 'md:text-2xl',
    '3xl': 'md:text-3xl',
    '4xl': 'md:text-4xl',
    '5xl': 'md:text-5xl',
    '6xl': 'md:text-6xl',
  },
  lg: {
    xs: 'lg:text-xs',
    sm: 'lg:text-sm',
    base: 'lg:text-base',
    lg: 'lg:text-lg',
    xl: 'lg:text-xl',
    '2xl': 'lg:text-2xl',
    '3xl': 'lg:text-3xl',
    '4xl': 'lg:text-4xl',
    '5xl': 'lg:text-5xl',
    '6xl': 'lg:text-6xl',
  },
  xl: {
    xs: 'xl:text-xs',
    sm: 'xl:text-sm',
    base: 'xl:text-base',
    lg: 'xl:text-lg',
    xl: 'xl:text-xl',
    '2xl': 'xl:text-2xl',
    '3xl': 'xl:text-3xl',
    '4xl': 'xl:text-4xl',
    '5xl': 'xl:text-5xl',
    '6xl': 'xl:text-6xl',
  },
  '2xl': {
    xs: '2xl:text-xs',
    sm: '2xl:text-sm',
    base: '2xl:text-base',
    lg: '2xl:text-lg',
    xl: '2xl:text-xl',
    '2xl': '2xl:text-2xl',
    '3xl': '2xl:text-3xl',
    '4xl': '2xl:text-4xl',
    '5xl': '2xl:text-5xl',
    '6xl': '2xl:text-6xl',
  },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type TextVariant = NonNullable<
  VariantProps<typeof textVariants>['variant']
>
export type TextColor = NonNullable<VariantProps<typeof textVariants>['color']>

export type TextStyleProps = {
  variant?: TextVariant
  color?: TextColor
  align?: Responsive<TextAlign>
  wrap?: Responsive<TextWrap>
  size?: Responsive<TextSize>
}

type TextProps<E extends TextTag = 'p'> = TextStyleProps & {
  as?: E
  className?: string
} & Omit<ComponentPropsWithoutRef<E>, keyof TextStyleProps | 'className'>

// ─── Component ────────────────────────────────────────────────────────────────

function Text<E extends TextTag = 'p'>({
  as,
  variant,
  color,
  align,
  wrap,
  size,
  className,
  children,
  ...props
}: TextProps<E>): JSX.Element {
  const Tag = (as ?? 'p') as ElementType
  return (
    <Tag
      className={twMerge(
        textVariants({ variant, color }),
        ...resolveFlexProp(align, TEXT_ALIGN),
        ...resolveFlexProp(wrap, TEXT_WRAP),
        ...resolveFlexProp(size, TEXT_SIZE),
        className,
      )}
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
