import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva(
  'relative inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-(--BUTTON-RADIUS) font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-(--BUTTON-PRIMARY-BACKGROUND) text-(--BUTTON-PRIMARY-FOREGROUND) transition-opacity duration-50 hover:opacity-85',
        destructive:
          'bg-(--BUTTON-DESTRUCTIVE-BACKGROUND) text-(--BUTTON-DESTRUCTIVE-FOREGROUND) hover:opacity-90',
        secondary:
          'bg-(--BUTTON-SECONDARY-BACKGROUND) text-(--BUTTON-SECONDARY-FOREGROUND) hover:opacity-90',
        ghost:
          'bg-(--BUTTON-GHOST-BACKGROUND) text-(--BUTTON-GHOST-FOREGROUND) hover:opacity-80',
      },
      size: {
        default:
          'h-(--BUTTON-SIZE-DEFAULT-HEIGHT) px-(--BUTTON-SIZE-DEFAULT-PADDING_X) py-(--BUTTON-SIZE-DEFAULT-PADDING_Y)',
        sm: 'h-(--BUTTON-SIZE-SM-HEIGHT) px-(--BUTTON-SIZE-SM-PADDING_X) py-(--BUTTON-SIZE-SM-PADDING_Y) text-sm',
        lg: 'h-(--BUTTON-SIZE-LG-HEIGHT) px-(--BUTTON-SIZE-LG-PADDING_X) py-(--BUTTON-SIZE-LG-PADDING_Y)',
        icon: 'h-(--BUTTON-SIZE-SM-HEIGHT) w-(--BUTTON-SIZE-SM-HEIGHT) p-2',
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
