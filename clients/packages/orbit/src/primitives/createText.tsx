import { cva, type VariantProps } from 'class-variance-authority'
import React, {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
} from 'react'
import { twMerge } from 'tailwind-merge'

// ─── Text tag union ───────────────────────────────────────────────────────────

type TextTag = 'p' | 'span' | 'label' | 'strong' | 'em' | 'small' | 'code' | 'div'

// ─── Variants ─────────────────────────────────────────────────────────────────
// All styling is encoded here — consumers pick a semantic variant, not raw props.

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

export type TextVariant = NonNullable<VariantProps<typeof textVariants>['variant']>
export type TextStyleProps = VariantProps<typeof textVariants>

type TextProps<E extends TextTag = 'p'> = TextStyleProps & {
  as?: E
  className?: string
} & Omit<ComponentPropsWithoutRef<E>, keyof TextStyleProps | 'className'>

// ─── Component ────────────────────────────────────────────────────────────────

function Text<E extends TextTag = 'p'>({
  as,
  variant,
  align,
  wrap,
  className,
  children,
  ...props
}: TextProps<E>): JSX.Element {
  const Tag = (as ?? 'p') as ElementType
  return (
    <Tag
      className={twMerge(textVariants({ variant, align, wrap }), className)}
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
