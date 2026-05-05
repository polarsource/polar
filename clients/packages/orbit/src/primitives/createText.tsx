import { cva, type VariantProps } from 'class-variance-authority'
import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
  type ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'

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

const HEADING_BASE = 'font-display text-black dark:text-white'

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
      'heading-xl': `${HEADING_BASE} text-5xl md:text-7xl`,
      /** Section headline — h2 sizing. */
      'heading-l': `${HEADING_BASE} text-4xl md:text-5xl`,
      /** Section headline — h3 sizing. */
      'heading-m': `${HEADING_BASE} text-3xl md:text-5xl`,
      /** Subsection headline — h4 sizing. */
      'heading-s': `${HEADING_BASE} text-2xl md:text-3xl`,
      /** Card/list headline — h5 sizing. */
      'heading-xs': `${HEADING_BASE} text-xl md:text-2xl`,
      /** Smallest headline — h6 sizing. */
      'heading-xxs': `${HEADING_BASE} text-lg md:text-xl`,
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

export type TextVariant = NonNullable<
  VariantProps<typeof textVariants>['variant']
>
export type TextColor = NonNullable<VariantProps<typeof textVariants>['color']>
export type TextStyleProps = VariantProps<typeof textVariants>

type TextProps<E extends TextTag = 'p'> = TextStyleProps & {
  as?: E
  className?: string
  loading?: boolean
  placeholderText?: string
  placeholderNumberOfLines?: number
} & Omit<
    ComponentPropsWithoutRef<E>,
    keyof TextStyleProps | 'className' | 'loading'
  >

const HEADING_FONT_FEATURES = "'ss07' 1, 'ss08' 1, 'zero' 1, 'liga' 0"
const SKELETON_CLASSES =
  'dark:bg-polar-700 animate-pulse rounded-sm bg-gray-100'

const renderMultiLineSkeleton = (lines: number): ReactNode =>
  Array.from({ length: lines }, (_, i) => (
    <span
      key={i}
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '1lh',
      }}
    >
      <span
        className={SKELETON_CLASSES}
        style={{
          display: 'block',
          height: '1em',
          width: i === lines - 1 ? '60%' : '100%',
        }}
      />
    </span>
  ))

const renderSingleLineSkeleton = (placeholder: ReactNode): ReactNode => (
  <>
    <span style={{ visibility: 'hidden' }}>{placeholder}</span>
    <span
      aria-hidden
      className={SKELETON_CLASSES}
      style={{ position: 'absolute', inset: 0 }}
    />
  </>
)

function Text<E extends TextTag = 'p'>({
  as,
  variant,
  color,
  align,
  wrap,
  className,
  children,
  style,
  loading,
  placeholderText,
  placeholderNumberOfLines,
  ...props
}: TextProps<E> & { style?: React.CSSProperties }): JSX.Element {
  const Tag = (as ?? 'p') as ElementType
  const isHeading =
    typeof variant === 'string' && variant.startsWith('heading-')

  let content: ReactNode = children
  let loadingStyle: React.CSSProperties | undefined

  if (loading) {
    const lines = placeholderNumberOfLines ?? 1
    if (lines > 1) {
      content = renderMultiLineSkeleton(lines)
      loadingStyle = undefined
    } else {
      content = renderSingleLineSkeleton(
        placeholderText ?? children ?? 'Loading...',
      )
      loadingStyle = { position: 'relative', display: 'inline-block' }
    }
  }

  const mergedStyle: React.CSSProperties = {
    ...(isHeading && { fontFeatureSettings: HEADING_FONT_FEATURES }),
    ...style,
    ...loadingStyle,
  }

  return (
    <Tag
      className={twMerge(
        textVariants({ variant, color, align, wrap }),
        className,
      )}
      style={mergedStyle}
      {...(props as object)}
    >
      {content}
    </Tag>
  )
}

Text.displayName = 'Text'

export function createText() {
  return Text
}

export { Text }
