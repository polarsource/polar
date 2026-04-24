import { twMerge } from 'tailwind-merge'
import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Button — shared rounded pill button used across all landing sections.
 * Two variants: primary (white bg) and secondary (neutral bg).
 */

interface ButtonProps {
  children: ReactNode
  href?: string
  variant?: 'primary' | 'secondary'
  className?: string
}

export const Button = ({
  children,
  href = '#',
  variant = 'primary',
  className,
}: ButtonProps) => (
  <Link
    href={href}
    className={twMerge(
      "w-fit rounded-full px-8 py-4 text-lg font-semibold transition [font-variation-settings:'opsz'_32] text-nowrap",
      variant === 'primary'
        ? 'bg-neutral-900 text-neutral-100 dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200'
        : 'bg-neutral-200 text-neutral-900 dark:bg-dark-800 dark:text-white font-semibold hover:bg-neutral-300 dark:hover:bg-dark-700',
      className,
    )}
  >
    {children}
  </Link>
)
