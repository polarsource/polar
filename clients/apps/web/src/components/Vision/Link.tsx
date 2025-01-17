import NextLink from 'next/link'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export interface LinkProps extends ComponentProps<typeof NextLink> {
  variant?: 'primary' | 'ghost'
}

export const Link = ({ variant = 'primary', ...props }: LinkProps) => {
  const primaryClassName = 'border-b'
  const ghostClassName = 'border-none'

  return (
    <NextLink
      {...props}
      className={twMerge(
        'border-polar-200 focus-within:bg-polar-200 hover:bg-polar-200 flex w-fit flex-row gap-x-1 py-[1px] font-mono focus-within:text-black focus-within:outline-none hover:text-black',
        variant === 'primary' ? primaryClassName : ghostClassName,
        props.className,
      )}
    />
  )
}
