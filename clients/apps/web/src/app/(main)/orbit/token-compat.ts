import { orbitTokens } from '@polar-sh/orbit'

export const sp = orbitTokens

export const cl = {
  BG: orbitTokens.COLOR_BG,
  BG_SURFACE: orbitTokens.COLOR_BG_SURFACE,
  BG_ELEVATED: orbitTokens.COLOR_BG_ELEVATED,
  TEXT: orbitTokens.COLOR_TEXT,
  TEXT_SUBTLE: orbitTokens.COLOR_TEXT_SUBTLE,
  TEXT_DISABLED: orbitTokens.COLOR_TEXT_DISABLED,
  DESTRUCTIVE: orbitTokens.COLOR_DESTRUCTIVE,
} as const

export const ra = {
  SM: orbitTokens.RADII_SM,
  MD: orbitTokens.RADII_MD,
  LG: orbitTokens.RADII_LG,
  XL: orbitTokens.RADII_XL,
  FULL: orbitTokens.RADII_FULL,
} as const

const spacingKeys = [
  'SPACING_0',
  'SPACING_1',
  'SPACING_2',
  'SPACING_3',
  'SPACING_4',
  'SPACING_5',
  'SPACING_6',
  'SPACING_7',
  'SPACING_8',
  'SPACING_9',
  'SPACING_10',
  'SPACING_11',
  'SPACING_12',
  'SPACING_13',
  'SPACING_14',
] as const

const radiiKeys = [
  'RADII_SM',
  'RADII_MD',
  'RADII_LG',
  'RADII_XL',
  'RADII_2XL',
  'RADII_FULL',
] as const

export const spacingEntries = spacingKeys.map((key) => ({ key, cssVar: orbitTokens[key] }))
export const radiiEntries = radiiKeys.map((key) => ({ key, cssVar: orbitTokens[key] }))
