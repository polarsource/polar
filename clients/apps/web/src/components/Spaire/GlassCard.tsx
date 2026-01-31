'use client'

import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: 'emerald' | 'blue' | 'purple' | 'amber' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function GlassCard({
  children,
  className,
  hover = true,
  glow = 'none',
  padding = 'lg',
}: GlassCardProps) {
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
      whileHover={
        hover
          ? {
              y: -2,
              transition: { duration: 0.2, ease: 'easeOut' },
            }
          : undefined
      }
      className={twMerge(
        'relative overflow-hidden rounded-3xl',
        'bg-white/[0.03] dark:bg-white/[0.02]',
        'backdrop-blur-xl',
        'border border-white/[0.08]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.12)]',
        hover && [
          'transition-all duration-300 ease-out',
          'hover:border-white/[0.15]',
          'hover:shadow-[0_12px_48px_rgba(0,0,0,0.16)]',
          'hover:bg-white/[0.05] dark:hover:bg-white/[0.04]',
        ],
        glow !== 'none' && [
          'before:absolute before:inset-0 before:-z-10',
          'before:rounded-3xl before:blur-3xl before:opacity-50',
          glowColors[glow],
        ],
        paddingClasses[padding],
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </motion.div>
  )
}
