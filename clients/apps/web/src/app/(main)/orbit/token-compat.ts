/**
 * Compatibility shim for orbit demo pages.
 * Provides sp / cl / ra shorthand objects for use in className strings.
 *
 * Since Box and Stack now use Tailwind classes only, colors and radii are
 * applied via className using CSS-variable Tailwind shorthand, e.g.:
 *   className="bg-(--COLOR_BG_SURFACE) rounded-(--RADII_LG)"
 *
 * The cl / ra objects below provide the raw CSS variable strings for use in
 * arbitrary Tailwind values or inline styles if needed.
 */

/** Spacing step → Tailwind gap/padding class (CSS variable shorthand). */
export const sp = {
  SPACING_0: 0,
  SPACING_1: 1,
  SPACING_2: 2,
  SPACING_3: 3,
  SPACING_4: 4,
  SPACING_5: 5,
  SPACING_6: 6,
  SPACING_7: 7,
  SPACING_8: 8,
  SPACING_9: 9,
  SPACING_10: 10,
  SPACING_11: 11,
  SPACING_12: 12,
  SPACING_13: 13,
  SPACING_14: 14,
} as const satisfies Record<string, import('@polar-sh/orbit').StackGap>

/** Color CSS variable strings — use in className, e.g. `bg-(--COLOR_BG_SURFACE)`. */
export const cl = {
  BG:            'var(--COLOR_BG)',
  BG_SURFACE:    'var(--COLOR_BG_SURFACE)',
  BG_ELEVATED:   'var(--COLOR_BG_ELEVATED)',
  TEXT:          'var(--COLOR_TEXT)',
  TEXT_SUBTLE:   'var(--COLOR_TEXT_SUBTLE)',
  TEXT_DISABLED: 'var(--COLOR_TEXT_DISABLED)',
  DESTRUCTIVE:   'var(--COLOR_DESTRUCTIVE)',
} as const

/** Radius CSS variable strings — use in className, e.g. `rounded-(--RADII_LG)`. */
export const ra = {
  SM:   'var(--RADII_SM)',
  MD:   'var(--RADII_MD)',
  LG:   'var(--RADII_LG)',
  XL:   'var(--RADII_XL)',
  '2XL': 'var(--RADII_2XL)',
  FULL: 'var(--RADII_FULL)',
} as const
