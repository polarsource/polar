'use client'

import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export const NaviagtionItem = ({
  children,
  icon,
  className,
  ...props
}: PropsWithChildren<
  LinkProps & { className?: string; icon?: JSX.Element }
>) => {
  const pathname = usePathname()
  const active = pathname.includes(props.href as string)

  return (
    <Link
      {...props}
      className={twMerge(
        'flex flex-row items-center gap-x-4 transition-colors hover:text-black dark:hover:text-white',
        active
          ? 'text-black dark:text-white'
          : 'dark:text-polar-500 text-gray-500',
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
