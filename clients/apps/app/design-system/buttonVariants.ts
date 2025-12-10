import {
  BorderRadiiToken,
  ColorToken,
  SpacingToken,
} from '@/design-system/theme'

type ButtonVariant = {
  backgroundColor?: ColorToken
  borderWidth?: number
  borderColor?: ColorToken
  paddingHorizontal?: SpacingToken
  paddingVertical?: SpacingToken
  borderRadius?: BorderRadiiToken
  alignItems?: 'center' | 'flex-start' | 'flex-end'
  justifyContent?: 'center' | 'flex-start' | 'flex-end'
}

type ButtonVariants = {
  defaults: ButtonVariant
} & Record<string, ButtonVariant>

export const buttonVariants: ButtonVariants = {
  primary: {
    backgroundColor: 'foreground-regular',
  },
  secondary: {
    backgroundColor: 'background-regular',
    borderWidth: 1,
    borderColor: 'foreground-regular',
  },
  defaults: {
    paddingHorizontal: 'spacing-24',
    paddingVertical: 'spacing-16',
    borderRadius: 'border-radius-full',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
