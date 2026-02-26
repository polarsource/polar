import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva(
  'relative inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-xl font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-blue-500 text-white transition-opacity duration-50 hover:opacity-85',
        destructive:
          'bg-red-500 text-white hover:opacity-90',
        secondary:
          'bg-gray-100 text-gray-900 hover:opacity-90 dark:bg-polar-700 dark:text-white',
        ghost:
          'bg-transparent text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-polar-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 py-1.5 text-sm',
        lg: 'h-12 px-5 py-3',
        icon: 'h-8 w-8 p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    ref?: React.RefObject<HTMLButtonElement>
    loading?: boolean
    fullWidth?: boolean
    wrapperClassName?: string
  }

export const Button = ({
  ref,
  className,
  variant,
  size,
  loading,
  fullWidth,
  disabled,
  wrapperClassName,
  children,
  type = 'button',
  ...props
}: ButtonProps) => {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={twMerge(
        buttonVariants({ variant, size }),
        fullWidth ? 'w-full' : '',
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 flex h-full w-full items-center justify-center">
            <LoadingSpinner disabled={disabled} size={size} />
          </span>
          <span
            className={twMerge(
              'flex flex-row items-center opacity-0',
              wrapperClassName,
            )}
          >
            {children}
          </span>
        </>
      ) : (
        <span
          className={twMerge('flex flex-row items-center', wrapperClassName)}
        >
          {children}
        </span>
      )}
    </button>
  )
}

Button.displayName = 'Button'

const LoadingSpinner = ({
  disabled,
  size,
}: {
  disabled?: boolean
  size?: ButtonProps['size']
}) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={twMerge(
      'animate-spin fill-current',
      disabled ? 'opacity-40' : '',
      size === 'lg' ? 'h-4 w-4' : 'h-3 w-3',
    )}
    role="status"
  >
    <path d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z" />
  </svg>
)
