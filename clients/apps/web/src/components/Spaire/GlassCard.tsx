'use client'

import { twMerge } from 'tailwind-merge'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export default function GlassCard({
  children,
  className,
  hover = true,
  padding = 'md',
  onClick,
}: GlassCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  return (
    <div
      onClick={onClick}
      className={twMerge(
        // Base glass effect
        'relative overflow-hidden rounded-2xl',
        // Light mode: subtle frosted white
        'bg-white/70 border border-gray-200/50',
        // Dark mode: translucent white glass
        'dark:bg-white/[0.08] dark:border-white/[0.12]',
        // Backdrop blur for glass effect
        'backdrop-blur-xl backdrop-saturate-150',
        // Shadow
        'shadow-sm dark:shadow-none',
        // Hover effects
        hover && [
          'transition-all duration-200 ease-out',
          'hover:-translate-y-0.5',
          'hover:border-gray-300/60 dark:hover:border-white/[0.18]',
          'hover:shadow-md dark:hover:shadow-none',
        ],
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
