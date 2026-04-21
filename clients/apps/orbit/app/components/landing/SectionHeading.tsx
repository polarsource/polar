import type { ReactNode } from 'react'

/**
 * SectionHeading — shared display heading used across all landing
 * sections. Inter Display via opsz axis, consistent size and weight.
 */
export const SectionHeading = ({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) => (
  <h2
    className={`text-[clamp(3rem,6vw,6rem)] leading-[1.2] font-normal text-white [font-variation-settings:'opsz'_32] ${className}`}
  >
    {children}
  </h2>
)
