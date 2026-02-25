/**
 * Compatibility shim for orbit demo pages.
 * Provides sp / cl / ra shorthand objects backed by the typed theme primitives.
 */
import { theme } from '@polar-sh/orbit'

/** Spacing tokens — maps SPACING_* keys to Spacing branded values. */
export const sp = {
  SPACING_0: theme.spacing[0],
  SPACING_1: theme.spacing[1],
  SPACING_2: theme.spacing[2],
  SPACING_3: theme.spacing[3],
  SPACING_4: theme.spacing[4],
  SPACING_5: theme.spacing[5],
  SPACING_6: theme.spacing[6],
  SPACING_7: theme.spacing[7],
  SPACING_8: theme.spacing[8],
  SPACING_9: theme.spacing[9],
  SPACING_10: theme.spacing[10],
  SPACING_11: theme.spacing[11],
  SPACING_12: theme.spacing[12],
  SPACING_13: theme.spacing[13],
  SPACING_14: theme.spacing[14],
} as const

/** Color tokens — maps semantic color keys to Color branded values. */
export const cl = {
  BG: theme.colors.bg,
  BG_SURFACE: theme.colors.bgSurface,
  BG_ELEVATED: theme.colors.bgElevated,
  TEXT: theme.colors.text,
  TEXT_SUBTLE: theme.colors.textSubtle,
  TEXT_DISABLED: theme.colors.textDisabled,
  DESTRUCTIVE: theme.colors.destructive,
} as const

/** Radius tokens — maps size keys to Radius branded values. */
export const ra = {
  SM: theme.radius.sm,
  MD: theme.radius.md,
  LG: theme.radius.lg,
  XL: theme.radius.xl,
  '2XL': theme.radius['2xl'],
  FULL: theme.radius.full,
} as const
