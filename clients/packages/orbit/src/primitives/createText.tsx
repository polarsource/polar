import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type JSX,
  type ReactNode,
} from 'react'
import * as stylex from '@stylexjs/stylex'

import {
  textAlignStyles,
  textColorStyles,
  textRoleStyles,
  textUtilityStyles,
  textWrapStyles,
} from '../tokens/semantics.stylex'

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

export type TextVariant =
  | 'default'
  | 'body'
  | 'label'
  | 'caption'
  | 'heading-2xl'
  | 'heading-xl'
  | 'heading-l'
  | 'heading-m'
  | 'heading-s'
  | 'heading-xs'
  | 'heading-xxs'

export type TextColor =
  | 'default'
  | 'muted'
  | 'disabled'
  | 'accent'
  | 'danger'
  | 'error'
  | 'warning'
  | 'success'
  | 'inverse'
  | 'white'
  | 'black'
  | 'inherit'

export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type TextWrap = 'wrap' | 'nowrap' | 'balance' | 'pretty'

export type TextStyleProps = {
  variant?: TextVariant
  color?: TextColor
  align?: TextAlign
  wrap?: TextWrap
}

// The role each variant plays decides which element it should render as, so the
// integrator picks a role and gets a sane document outline for free. Override
// with `as` when the surrounding structure needs a different heading level.
// Non-heading roles stay `p` (the historical default) to avoid block/inline
// layout shifts; heading roles map down the outline so they stop rendering as
// `<p>`, which is the real accessibility win here.
const VARIANT_DEFAULT_TAG: Record<TextVariant, TextTag> = {
  default: 'p',
  body: 'p',
  label: 'p',
  caption: 'p',
  'heading-2xl': 'h1',
  'heading-xl': 'h2',
  'heading-l': 'h3',
  'heading-m': 'h4',
  'heading-s': 'h5',
  'heading-xs': 'h6',
  'heading-xxs': 'h6',
}

// Good wrapping is a decision the component makes, not the caller: headings read
// best balanced across lines, long body copy best avoids orphans. Anything not
// listed keeps the browser default. Overridden by an explicit `wrap` prop, and
// skipped entirely when truncating.
const VARIANT_DEFAULT_WRAP: Partial<
  Record<TextVariant, NonNullable<TextStyleProps['wrap']>>
> = {
  body: 'pretty',
  'heading-2xl': 'balance',
  'heading-xl': 'balance',
  'heading-l': 'balance',
}

// Pinned locale so server and client render identical strings (an unpinned
// Intl default would risk a hydration mismatch).
const numberFormatter = new Intl.NumberFormat('en-US')
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact' })

/**
 * How to render the value passed as children. A named preset keeps the common
 * cases discoverable; the function form is the escape hatch for the long tail
 * (currency, units, locale-specific rules). Either way the output is a string,
 * so no visual decision leaks out of the component.
 */
export type TextFormatter =
  | 'number'
  | 'compact'
  | ((value: string | number) => string)

function applyFormatter(
  formatter: TextFormatter,
  value: string | number,
): string {
  if (typeof formatter === 'function') return formatter(value)
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(n)) return String(value)
  return formatter === 'compact'
    ? compactFormatter.format(n)
    : numberFormatter.format(n)
}

type TextProps<E extends TextTag = 'p'> = TextStyleProps & {
  /**
   * The role this text plays, which decides its size, weight and font family.
   * Headings use the display scale; `body`/`default`/`label`/`caption` cover
   * supporting copy. Pick the role, never a raw size.
   */
  variant?: TextStyleProps['variant']
  /**
   * Semantic foreground color that resolves for light and dark automatically.
   * Use `inherit` to adopt the color of a parent Box.
   */
  color?: TextStyleProps['color']
  /**
   * Underlying DOM element. Defaults to a sensible element per variant (heading
   * variants render `h1`–`h6`, everything else `p`). Override to keep a correct
   * document outline. DOM props for the element are typed and forwarded.
   */
  as?: E
  /**
   * Horizontal text alignment.
   */
  align?: TextStyleProps['align']
  /**
   * Line-wrapping behavior. Defaults are baked per role (headings `balance`,
   * body `pretty`); set this to override. Ignored while truncating.
   */
  wrap?: TextStyleProps['wrap']
  /**
   * The text to render. Prefer plain strings and numbers; inline elements are
   * allowed where you genuinely need them (a `<br>`, an inline link), but reach
   * for Box to compose layout rather than nesting containers inside Text.
   */
  children?: ReactNode
  /**
   * Render a pulsing skeleton placeholder instead of children, for content that
   * is still loading.
   */
  loading?: boolean
  /**
   * Sizes the single-line loading skeleton. Falls back to children, then to
   * "Loading...".
   */
  placeholderText?: string
  /**
   * When greater than 1, renders a multi-line loading skeleton with that many
   * lines.
   */
  placeholderNumberOfLines?: number
  /**
   * Apply a line-through decoration, e.g. for a struck-out previous price.
   */
  lineThrough?: boolean
  /**
   * Render in the monospace font family while keeping the variant's size and
   * weight. Orthogonal to `variant`, so any text can be monospaced.
   */
  monospace?: boolean
  /**
   * Align figures for vertical scanning in tables and stat readouts. Pairs well
   * with a numeric `formatter`.
   */
  tabularNums?: boolean
  /**
   * Truncate overflow. `true` clamps to a single line with an ellipsis; a
   * number clamps to that many lines. The component owns the CSS, so callers
   * never hand-roll line-clamp utilities.
   */
  truncate?: boolean | number
  /**
   * Format the children value for display. 'number' adds grouping separators
   * (3290033 → "3,290,033"), 'compact' shortens (3290033 → "3.3M"), or pass a
   * function for full control. Pass the raw value as children, not a
   * pre-formatted string.
   */
  formatter?: TextFormatter
} & Omit<
    ComponentPropsWithoutRef<E>,
    keyof TextStyleProps | 'className' | 'loading' | 'children'
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
  children,
  style,
  loading,
  placeholderText,
  placeholderNumberOfLines,
  lineThrough,
  monospace,
  tabularNums,
  truncate,
  formatter,
  ...props
}: TextProps<E> & { style?: React.CSSProperties }): JSX.Element {
  const resolvedVariant = variant ?? 'default'
  const Tag = (as ?? VARIANT_DEFAULT_TAG[resolvedVariant]) as ElementType
  const isHeading = resolvedVariant.startsWith('heading-')
  const resolvedWrap =
    wrap ?? (truncate ? undefined : VARIANT_DEFAULT_WRAP[resolvedVariant])

  let content: ReactNode =
    formatter !== undefined &&
    (typeof children === 'string' || typeof children === 'number')
      ? applyFormatter(formatter, children)
      : children
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

  const stylexProps = stylex.props(
    textRoleStyles[resolvedVariant],
    textColorStyles[color ?? 'default'],
    align && textAlignStyles[align],
    resolvedWrap && textWrapStyles[resolvedWrap],
    monospace && textUtilityStyles.monospace,
    tabularNums && textUtilityStyles.tabularNums,
    lineThrough && textUtilityStyles.lineThrough,
    truncate === true && textUtilityStyles.truncate,
  )

  const mergedStyle: React.CSSProperties = {
    ...stylexProps.style,
    ...(isHeading && { fontFeatureSettings: HEADING_FONT_FEATURES }),
    ...(typeof truncate === 'number'
      ? {
          display: '-webkit-box',
          WebkitLineClamp: truncate,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }
      : {}),
    ...style,
    ...loadingStyle,
  }

  return (
    <Tag
      className={stylexProps.className}
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
