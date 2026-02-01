'use client'

import { twMerge } from 'tailwind-merge'

/**
 * SDS Button Component
 * Stripe Design System style buttons
 *
 * Features:
 * - Clean, professional appearance
 * - 8px grid compliant padding
 * - Subtle hover/active states
 */

interface SDSButtonProps {
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export default function SDSButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
}: SDSButtonProps) {
  // 8px grid compliant sizing
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm gap-1.5',       // 32px height
    md: 'h-10 px-4 text-sm gap-2',        // 40px height
    lg: 'h-12 px-6 text-base gap-2',      // 48px height
  }

  const variantClasses = {
    primary: [
      'bg-[#635BFF] text-white',
      'hover:bg-[#5046E5]',
      'active:bg-[#4338CA]',
      'disabled:bg-[#A5B4FC] disabled:cursor-not-allowed',
    ],
    secondary: [
      'bg-white dark:bg-[#112240]',
      'text-[#0A2540] dark:text-[#E6F1FF]',
      'border border-[#D1D9E6] dark:border-[#2D4A6F]',
      'hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F]',
      'hover:border-[#B8C4CE] dark:hover:border-[#3D5A7F]',
      'active:bg-[#EDF2F7] dark:active:bg-[#0A192F]',
      'disabled:text-[#8792A2] dark:disabled:text-[#5C6B8A] disabled:cursor-not-allowed',
    ],
    ghost: [
      'bg-transparent',
      'text-[#425466] dark:text-[#A8B2D1]',
      'hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F]',
      'hover:text-[#0A2540] dark:hover:text-[#E6F1FF]',
      'active:bg-[#EDF2F7] dark:active:bg-[#112240]',
      'disabled:text-[#8792A2] dark:disabled:text-[#5C6B8A] disabled:cursor-not-allowed',
    ],
    link: [
      'bg-transparent',
      'text-[#635BFF] dark:text-[#818CF8]',
      'hover:text-[#5046E5] dark:hover:text-[#A5B4FC]',
      'hover:underline',
      'active:text-[#4338CA] dark:active:text-[#C7D2FE]',
      'disabled:text-[#A5B4FC] disabled:cursor-not-allowed disabled:no-underline',
    ],
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={twMerge(
        'inline-flex items-center justify-center',
        'font-medium tracking-[-0.01em]',
        'rounded-lg',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:ring-offset-2',
        'dark:focus:ring-offset-[#0A192F]',
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  )
}
