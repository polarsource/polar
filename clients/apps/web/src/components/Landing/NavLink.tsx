'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ComponentProps, MouseEvent } from 'react'
import { twMerge } from 'tailwind-merge'

export const NavLink = ({
  href,
  className,
  children,
  isActive: _isActive,
  target,
  onClick,
  ...props
}: ComponentProps<typeof Link> & {
  isActive?: (pathname: string) => boolean
}) => {
  const pathname = usePathname()
  const hrefString = href.toString()
  const isActive = _isActive
    ? _isActive(pathname)
    : pathname.startsWith(hrefString)
  const isExternal = hrefString.startsWith('http')

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return

    const hashIndex = hrefString.indexOf('#')
    if (hashIndex === -1) return

    const targetPath = hrefString.slice(0, hashIndex) || '/'
    if (targetPath !== pathname) return

    const targetId = hrefString.slice(hashIndex + 1)
    if (!targetId) return

    event.preventDefault()
    // Toggle sidebar hack for mobile
    const delay = onClick ? 350 : 0
    window.setTimeout(() => {
      const element = document.getElementById(targetId)
      if (!element) return
      element.scrollIntoView()
      window.history.replaceState(null, '', hrefString)
    }, delay)
  }

  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : target}
      prefetch
      onClick={handleClick}
      className={twMerge(
        'dark:text-polar-500 -m-1 flex items-center gap-x-2 p-1 text-gray-500 transition-colors hover:text-black dark:hover:text-white',
        isActive && 'text-black dark:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
}
