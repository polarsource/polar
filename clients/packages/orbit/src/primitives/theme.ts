import { tokens } from '../tokens/vars'

type Brand<T, K> = T & { _type: K }

export type Color = Brand<string, 'color'>
export type Dimension = Brand<string, 'dimension'>
export type Spacing = Brand<string, 'spacing'>
export type Radius = Brand<string, 'radius'>
export type FontSize = Brand<string, 'fontSize'>
export type FontWeight = Brand<
  '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900',
  'fontWeight'
>
export type Scalar = Brand<number, 'scalar'>

export interface Theme {
  colors: Record<string, Color>
  dimensions: Record<string, Dimension>
  spacing: Record<string, Spacing>
  radius: Record<string, Radius>
  fontSize: Record<string, FontSize>
  fontWeight: Record<string, FontWeight>
}

const color = (value: string) => value as Color
const spacing = (value: string) => value as Spacing
const radius = (value: string) => value as Radius

export const theme = {
  colors: {
    bg: color(tokens.COLOR_BG),
    bgSurface: color(tokens.COLOR_BG_SURFACE),
    bgElevated: color(tokens.COLOR_BG_ELEVATED),
    text: color(tokens.COLOR_TEXT),
    textSubtle: color(tokens.COLOR_TEXT_SUBTLE),
    textDisabled: color(tokens.COLOR_TEXT_DISABLED),
    destructive: color(tokens.COLOR_DESTRUCTIVE),
    buttonPrimaryBg: color(tokens.COLOR_BUTTON_PRIMARY_BG),
    buttonPrimaryFg: color(tokens.COLOR_BUTTON_PRIMARY_FG),
    buttonSecondaryBg: color(tokens.COLOR_BUTTON_SECONDARY_BG),
    buttonSecondaryFg: color(tokens.COLOR_BUTTON_SECONDARY_FG),
    buttonDestructiveFg: color(tokens.COLOR_BUTTON_DESTRUCTIVE_FG),
    buttonGhostBg: color(tokens.COLOR_BUTTON_GHOST_BG),
    buttonGhostFg: color(tokens.COLOR_BUTTON_GHOST_FG),
    statusNeutralBg: color(tokens.COLOR_STATUS_NEUTRAL_BG),
    statusNeutralFg: color(tokens.COLOR_STATUS_NEUTRAL_FG),
    statusSuccessBg: color(tokens.COLOR_STATUS_SUCCESS_BG),
    statusSuccessFg: color(tokens.COLOR_STATUS_SUCCESS_FG),
    statusWarningBg: color(tokens.COLOR_STATUS_WARNING_BG),
    statusWarningFg: color(tokens.COLOR_STATUS_WARNING_FG),
    statusErrorBg: color(tokens.COLOR_STATUS_ERROR_BG),
    statusInfoBg: color(tokens.COLOR_STATUS_INFO_BG),
    statusInfoFg: color(tokens.COLOR_STATUS_INFO_FG),
  },
  dimensions: {},
  spacing: {
    0: spacing(tokens.SPACING_0),
    1: spacing(tokens.SPACING_1),
    2: spacing(tokens.SPACING_2),
    3: spacing(tokens.SPACING_3),
    4: spacing(tokens.SPACING_4),
    5: spacing(tokens.SPACING_5),
    6: spacing(tokens.SPACING_6),
    7: spacing(tokens.SPACING_7),
    8: spacing(tokens.SPACING_8),
    9: spacing(tokens.SPACING_9),
    10: spacing(tokens.SPACING_10),
    11: spacing(tokens.SPACING_11),
    12: spacing(tokens.SPACING_12),
    13: spacing(tokens.SPACING_13),
    14: spacing(tokens.SPACING_14),
  },
  radius: {
    sm: radius(tokens.RADII_SM),
    md: radius(tokens.RADII_MD),
    lg: radius(tokens.RADII_LG),
    xl: radius(tokens.RADII_XL),
    '2xl': radius(tokens.RADII_2XL),
    full: radius(tokens.RADII_FULL),
  },
  fontSize: {},
  fontWeight: {},
} as const satisfies Theme
