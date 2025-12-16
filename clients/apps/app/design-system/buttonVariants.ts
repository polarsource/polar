import { ColorToken } from '@/design-system/theme'

type ButtonVariantStyle = {
  backgroundColor: ColorToken
  textColor: ColorToken
  disabledBackgroundColor: ColorToken
  disabledTextColor: ColorToken
}

export const buttonVariants = {
  primary: {
    backgroundColor: 'monochromeInverted',
    textColor: 'monochrome',
    disabledBackgroundColor: 'disabled',
    disabledTextColor: 'subtext',
  },
  secondary: {
    backgroundColor: 'card',
    textColor: 'monochromeInverted',
    disabledBackgroundColor: 'disabled',
    disabledTextColor: 'subtext',
  },
  destructive: {
    backgroundColor: 'errorSubtle',
    textColor: 'error',
    disabledBackgroundColor: 'disabled',
    disabledTextColor: 'subtext',
  },
} as const satisfies Record<string, ButtonVariantStyle>

export type ButtonVariantKey = keyof typeof buttonVariants
