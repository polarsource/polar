import { twMerge } from 'tailwind-merge'
import type { ReactNode } from 'react'

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
  <a
    href={href}
    className={twMerge(
      "w-fit rounded-full px-8 py-4 text-base font-bold transition [font-variation-settings:'opsz'_32]",
      variant === 'primary'
        ? 'bg-white text-black hover:bg-neutral-200'
        : 'bg-dark-800 font-semibold text-white hover:bg-dark-700',
      className,
    )}
  >
    {children}
  </a>
)
