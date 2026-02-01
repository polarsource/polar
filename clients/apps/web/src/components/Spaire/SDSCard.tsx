'use client'

import { twMerge } from 'tailwind-merge'

/**
 * SDS Card Component
 * Stripe Design System "Elevated Flat" style
 *
 * Features:
 * - 1px border slightly darker/lighter than background
 * - Soft, multi-layered box shadow
 * - 8px grid compliant padding
 */

interface SDSCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  elevated?: boolean
  interactive?: boolean
  onClick?: () => void
}

export default function SDSCard({
  children,
  className,
  padding = 'md',
  elevated = true,
  interactive = false,
  onClick,
}: SDSCardProps) {
  // 8px grid compliant padding
  const paddingClasses = {
    none: '',
    sm: 'p-4',     // 16px
    md: 'p-6',     // 24px
    lg: 'p-8',     // 32px
  }

  return (
    <div
      onClick={onClick}
      className={twMerge(
        'rounded-xl',
        // Background - Light: white, Dark: elevated surface
        'bg-white dark:bg-[#112240]',
        // Border - Subtle, 1px
        'border border-[#E3E8EF] dark:border-[#1E3A5F]',
        // Elevation - Multi-layered soft shadow
        elevated && [
          'shadow-[0_1px_3px_0_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.04)]',
          'dark:shadow-[0_2px_4px_0_rgba(0,0,0,0.3),0_1px_2px_-1px_rgba(0,0,0,0.2)]',
        ],
        // Interactive states
        interactive && [
          'cursor-pointer',
          'transition-all duration-200',
          'hover:border-[#D1D9E6] dark:hover:border-[#2D4A6F]',
          'hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.04)]',
          'dark:hover:shadow-[0_4px_8px_-1px_rgba(0,0,0,0.4),0_2px_4px_-2px_rgba(0,0,0,0.3)]',
        ],
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * SDS Card Header
 */
interface SDSCardHeaderProps {
  children: React.ReactNode
  className?: string
  border?: boolean
}

export function SDSCardHeader({
  children,
  className,
  border = false,
}: SDSCardHeaderProps) {
  return (
    <div
      className={twMerge(
        'flex items-center justify-between',
        border && 'border-b border-[#E3E8EF] dark:border-[#1E3A5F] pb-4 mb-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * SDS Card Title
 */
interface SDSCardTitleProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function SDSCardTitle({
  children,
  className,
  size = 'md',
}: SDSCardTitleProps) {
  const sizeClasses = {
    sm: 'text-sm font-medium',
    md: 'text-base font-medium',
    lg: 'text-lg font-semibold',
  }

  return (
    <h3
      className={twMerge(
        'text-[#0A2540] dark:text-[#E6F1FF]',
        'tracking-[-0.01em]',
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </h3>
  )
}

/**
 * SDS Card Content
 */
interface SDSCardContentProps {
  children: React.ReactNode
  className?: string
}

export function SDSCardContent({ children, className }: SDSCardContentProps) {
  return <div className={twMerge('', className)}>{children}</div>
}

/**
 * SDS Card Footer
 */
interface SDSCardFooterProps {
  children: React.ReactNode
  className?: string
  border?: boolean
}

export function SDSCardFooter({
  children,
  className,
  border = false,
}: SDSCardFooterProps) {
  return (
    <div
      className={twMerge(
        'flex items-center',
        border && 'border-t border-[#E3E8EF] dark:border-[#1E3A5F] pt-4 mt-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
