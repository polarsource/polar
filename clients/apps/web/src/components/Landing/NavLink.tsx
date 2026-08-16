'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ComponentProps, MouseEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const NavLink = ({
  href,
  className,
  children,
  isActive: _isActive,
  target,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string
  isActive?: (pathname: string) => boolean
}) => {
  const pathname = usePathname()
  const isActive = _isActive ? _isActive(pathname) : pathname.startsWith(href)
  const isExternal = href.startsWith('http')
  const linkTarget = isExternal ? '_blank' : target

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (linkTarget && linkTarget !== '_self')
    ) {
      return
    }

    const hashIndex = href.indexOf('#')
    if (hashIndex === -1) return

    const targetId = href.slice(hashIndex + 1)
    if (!targetId) {
      // A bare `#` href is an action (e.g. mobile Login), not a destination
      event.preventDefault()
      return
    }

    const targetPath = href.slice(0, hashIndex) || '/'
    if (targetPath !== pathname) return

    event.preventDefault()
    // Toggle sidebar hack for mobile
    const delay = onClick ? 350 : 0
    window.setTimeout(() => {
      const element = document.getElementById(targetId)
      if (!element) return
      element.scrollIntoView()
      window.history.replaceState(null, '', href)
    }, delay)
  }

  return (
    <Link
      href={href}
      target={linkTarget}
      prefetch
      onClick={handleClick}
      className={twMerge(className)}
      {...props}
    >
      <Box
        as="span"
        display="inline-flex"
        color={{
          base: isActive ? 'text-primary' : 'text-secondary',
          hover: 'text-primary',
        }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <Text variant="heading-xxs" color="inherit">
          {children}
        </Text>
      </Box>
    </Link>
  )
}
