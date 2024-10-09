'use client'

import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export const NavigationItem = ({
  children,
  icon,
  className,
  active,
  ...props
}: PropsWithChildren<
  LinkProps & {
    className?: string
    icon?: JSX.Element
    active?(pathname: string): boolean
  }
>) => {
  const pathname = decodeURIComponent(usePathname())
  const fallbackActive =
    active?.(pathname) ??
    (pathname === props.href || `/docs${pathname}` === props.href)

  return (
    <Link
      {...props}
      className={twMerge(
        '-mx-3 flex flex-row items-center gap-x-3 rounded-lg px-3 py-2 text-sm transition-colors hover:text-black dark:hover:text-white',
        fallbackActive
          ? 'dark:bg-polar-800 bg-gray-50 font-medium text-black shadow-sm dark:text-white'
          : 'dark:text-polar-500 text-gray-500',
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
