import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface LandingSectionProps {
  children: ReactNode
  id?: string
  className?: string
}

export const LandingSection = ({
  children,
  id,
  className = '',
}: LandingSectionProps) => (
  <section
    id={id}
    className={twMerge(
      'max-w-[1760px] w-full mx-auto py-8 md:py-24',
      className,
    )}
  >
    {children}
  </section>
)
