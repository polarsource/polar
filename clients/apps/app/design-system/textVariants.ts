import { ColorToken } from '@/design-system/theme'

type TextVariant = {
  color?: ColorToken
  fontSize?: number
  lineHeight?: number
  fontWeight?: '400' | '500' | '600' | '700' | 'bold'
  fontFamily?: string
  textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase'
}

export const textVariants = {
  defaults: {
    color: 'text',
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  captionSmall: {
    fontSize: 8,
    lineHeight: 12,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
  },
  titleLarge: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  headline: {
    fontSize: 22,
    lineHeight: 30,
  },
  headlineLarge: {
    fontSize: 32,
    lineHeight: 40,
  },
  headlineXLarge: {
    fontSize: 36,
    lineHeight: 48,
  },
  display: {
    fontSize: 58,
    lineHeight: 64,
    fontWeight: '500',
    fontFamily: 'InstrumentSerif_400Regular',
  },
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonSmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  pill: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
} satisfies Record<string, TextVariant>

export type TextVariantKey = Exclude<keyof typeof textVariants, 'defaults'>
