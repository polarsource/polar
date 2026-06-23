import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { Box } from './Box'
import { Grid } from './Grid'
import { GridItem } from './GridItem'
import { Text, type TextColor } from './Text'
import type { BackgroundColorToken } from '../tokens/semantics.stylex'

export type AlertVariant = 'notice' | 'warning' | 'danger' | 'success'

// The variant is the only styling lever: it picks the icon, the tinted surface
// and the accent color so callers never reach for an icon or a color token.
const variantStyles: Record<
  AlertVariant,
  {
    icon: LucideIcon
    backgroundColor: BackgroundColorToken
    accentColor: TextColor
  }
> = {
  notice: {
    icon: Info,
    backgroundColor: 'background-accent',
    accentColor: 'accent',
  },
  warning: {
    icon: TriangleAlert,
    backgroundColor: 'background-warning',
    accentColor: 'warning',
  },
  danger: {
    icon: CircleAlert,
    backgroundColor: 'background-danger',
    accentColor: 'danger',
  },
  success: {
    icon: CircleCheck,
    backgroundColor: 'background-success',
    accentColor: 'success',
  },
}

export interface AlertProps {
  /**
   * Picks the icon, surface tint and accent color in one go. Use it to map the
   * alert to its meaning rather than styling icon and colors by hand.
   */
  variant: AlertVariant
  /**
   * The headline of the alert, rendered in the variant's accent color.
   */
  title: string
  /**
   * Supporting copy shown beneath the title. Omit for a title-only alert.
   */
  description?: string
  /**
   * Swaps the variant icon for a spinner, for an alert whose subject is still
   * resolving. Colors and layout are unchanged.
   */
  loading?: boolean
  /**
   * Called when the dismiss button is pressed. Provide it to render a dismiss
   * button; omit it for a persistent alert.
   */
  onDismiss?: () => void
}

// A button has no Box equivalent, so the dismiss control is a native button
// with its chrome reset; the grid places it and the Box inside carries the
// visible icon, its color and the hover affordance.
const dismissResetStyle: CSSProperties = {
  display: 'inline-flex',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'inherit',
}

// Collapsing the color-bearing span to a flex box drops the inline-SVG baseline
// gap, so the icon's box is exactly its 16px and the grid can center it cleanly
// against the title.
const iconBoxStyle: CSSProperties = { display: 'flex' }

// Styling is intentionally closed: no `className` escape hatch. The variant
// abstracts away the icon and every color decision.
export const Alert = ({
  variant,
  title,
  description,
  loading,
  onDismiss,
}: AlertProps) => {
  const {
    icon: VariantIcon,
    backgroundColor,
    accentColor,
  } = variantStyles[variant]
  const Icon = loading ? LoaderCircle : VariantIcon

  return (
    <Grid
      templateColumns={onDismiss ? 'auto 1fr auto' : 'auto 1fr'}
      columnGap="m"
      rowGap="xs"
      alignItems="center"
      backgroundColor={backgroundColor}
      borderRadius="s"
      padding="l"
      flexGrow={1}
    >
      <Text as="span" color={accentColor} style={iconBoxStyle}>
        <Icon
          size={16}
          aria-hidden
          className={loading ? 'animate-spin' : undefined}
        />
      </Text>
      <Text color={accentColor} variant="title">
        {title}
      </Text>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={dismissResetStyle}
        >
          <Box
            as="span"
            display="inline-flex"
            opacity={{ base: 0.6, hover: 1 }}
            transitionProperty="opacity"
            transitionDuration="fast"
          >
            <Text as="span" color={accentColor} style={iconBoxStyle}>
              <X size={16} aria-hidden />
            </Text>
          </Box>
        </button>
      )}
      {description && (
        <GridItem colStart={2}>
          <Text color={accentColor}>{description}</Text>
        </GridItem>
      )}
    </Grid>
  )
}
