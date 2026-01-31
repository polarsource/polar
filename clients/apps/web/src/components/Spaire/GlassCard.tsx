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
        // Light mode: crystal clear water glass
        'bg-white/20 border border-white/30',
        // Dark mode: ultra-translucent water glass
        'dark:bg-white/[0.02] dark:border-white/[0.04]',
        // Subtle backdrop blur for refraction effect
        'backdrop-blur-sm',
        // Hover
        hover && [
          'transition-all duration-200',
          'hover:-translate-y-0.5',
          'hover:bg-white/25 dark:hover:bg-white/[0.04]',
          'hover:border-white/40 dark:hover:border-white/[0.06]',
        ],
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
