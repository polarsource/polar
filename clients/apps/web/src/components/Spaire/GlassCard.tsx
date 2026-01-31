'use client'

import { motion } from 'framer-motion'
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: 'emerald' | 'blue' | 'purple' | 'amber' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      hover = true,
      glow = 'none',
      padding = 'lg',
      ...props
    },
    ref,
  ) => {
    const glowColors = {
      emerald: 'before:bg-emerald-500/10',
      blue: 'before:bg-blue-500/10',
      purple: 'before:bg-purple-500/10',
      amber: 'before:bg-amber-500/10',
      none: '',
    }

    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }

    return (
      <motion.div
        ref={ref}
        whileHover={
          hover
            ? {
                y: -2,
                transition: { duration: 0.2, ease: 'easeOut' },
              }
            : undefined
        }
        className={twMerge(
          // Base glass effect
          'relative overflow-hidden rounded-3xl',
          'bg-white/[0.03] dark:bg-white/[0.02]',
          'backdrop-blur-xl',
          // Chamfered edge border
          'border border-white/[0.08]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
          // Hover state
          hover && [
            'transition-all duration-300 ease-out',
            'hover:border-white/[0.15]',
            'hover:shadow-[0_12px_48px_rgba(0,0,0,0.16)]',
            'hover:bg-white/[0.05] dark:hover:bg-white/[0.04]',
          ],
          // Inner glow effect
          glow !== 'none' && [
            'before:absolute before:inset-0 before:-z-10',
            'before:rounded-3xl before:blur-3xl before:opacity-50',
            glowColors[glow],
          ],
          paddingClasses[padding],
          className,
        )}
        {...props}
      >
        {/* Top highlight edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        {children}
      </motion.div>
    )
  },
)

GlassCard.displayName = 'GlassCard'

export default GlassCard
