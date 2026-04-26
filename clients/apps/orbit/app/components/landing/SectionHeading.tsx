import type { ReactNode } from 'react'

/**
 * SectionHeading — shared display heading used across all landing
 * sections. Consistent size and weight.
 */
export const SectionHeading = ({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) => (
  <h2
    className={`text-[clamp(3rem,6vw,6rem)] leading-[1.2] font-normal text-neutral-900 dark:text-white ${className}`}
  >
    {children}
  </h2>
)
