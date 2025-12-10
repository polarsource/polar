export const buttonVariants = {
  primary: {
    backgroundColor: 'foreground-primary',
  },
  secondary: {
    backgroundColor: 'background-primary',
    borderWidth: 1,
    borderColor: 'foreground-primary',
  },
  defaults: {
    paddingHorizontal: 'spacing-24',
    paddingVertical: 'spacing-16',
    borderRadius: 'border-radius-full',
    alignItems: 'center',
    justifyContent: 'center',
  },
} as const
