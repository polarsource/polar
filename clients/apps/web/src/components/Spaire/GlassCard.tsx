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
        // Light mode: very subtle frosted glass
        'bg-white/40 border border-white/60',
        // Dark mode: translucent glass
        'dark:bg-white/[0.05] dark:border-white/[0.08]',
        // Backdrop blur
        'backdrop-blur-xl',
        // Hover
        hover && [
          'transition-all duration-200',
          'hover:-translate-y-0.5',
          'hover:bg-white/50 dark:hover:bg-white/[0.08]',
          'hover:border-white/70 dark:hover:border-white/[0.12]',
        ],
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
