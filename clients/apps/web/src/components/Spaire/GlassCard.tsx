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
        'relative overflow-hidden rounded-2xl',
        // Light mode: subtle frosted glass with visible tint
        'bg-gray-100/80 border border-gray-200/50',
        // Dark mode: subtle dark glass
        'dark:bg-polar-800/60 dark:border-polar-700/40',
        // Backdrop blur for glass effect
        'backdrop-blur-md',
        // Hover
        hover && [
          'transition-all duration-200',
          'hover:-translate-y-0.5',
          'hover:bg-gray-100/90 dark:hover:bg-polar-800/70',
          'hover:border-gray-200/70 dark:hover:border-polar-700/60',
        ],
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
