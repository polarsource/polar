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

const textVariants = cva('', {
  variants: {
    variant: {
      default: 'text-sm',
      body: 'text-base',
      label: 'text-xs font-medium',
      caption: 'text-xs leading-snug',
      'heading-2xl': `font-display text-6xl md:text-8xl`,
      'heading-xl': `font-display text-5xl md:text-7xl`,
      'heading-l': `font-display text-4xl md:text-5xl`,
      'heading-m': `text-3xl md:text-5xl`,
      'heading-s': `text-2xl md:text-3xl`,
      'heading-xs': `text-xl  md:text-2xl`,
      'heading-xxs': `text-lg  md:text-xl`,
    },
    color: {
      default: 'text-black dark:text-white',
      muted: 'text-gray-500 dark:text-polar-500',
      disabled: 'text-gray-400 dark:text-polar-600',
      accent: 'text-indigo-500 dark:text-indigo-500',
      danger: 'text-red-500 dark:text-red-500',
      error: 'text-red-500 dark:text-red-500',
      warning: 'text-amber-500 dark:text-amber-500',
      success: 'text-emerald-500 dark:text-emerald-500',
      inverse: 'text-white dark:text-black',
      white: 'text-white dark:text-white',
      black: 'text-black dark:text-black',
      inherit: '',
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
    variant: 'default',
    color: 'default',
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
  lineThrough?: boolean
  monospace?: boolean
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
  lineThrough,
  monospace,
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
    ...(lineThrough ? { textDecoration: 'line-through' } : {}),
    ...style,
    ...loadingStyle,
  }

  return (
    <Tag
      className={twMerge(
        textVariants({ variant, color, align, wrap }),
        monospace ? 'font-mono' : undefined,
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
