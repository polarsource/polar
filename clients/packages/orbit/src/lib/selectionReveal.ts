import { twMerge } from 'tailwind-merge'

export const selectionRevealClassName = (alwaysVisible: boolean) =>
  twMerge(
    'opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 pointer-coarse:opacity-100',
    alwaysVisible && 'opacity-100',
  )
