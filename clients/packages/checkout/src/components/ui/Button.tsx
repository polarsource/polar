import { cn } from '@polar-sh/ui/lib/utils'
import type * as React from 'react'

const baseClasses =
  'gap-2 [&_svg]:pointer-events-none [&_svg]:size-4! [&_svg]:shrink-0 h-10 px-4 py-2 relative inline-flex items-center cursor-pointer font-display font-[550] tracking-[0.01em] select-none justify-center rounded-full text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap'

const variantClasses = {
  default:
    'bg-black dark:bg-white dark:text-black text-white hover:opacity-85 transition-opacity duration-100',
  primary:
    'bg-[#0570de] text-white hover:opacity-85 transition-opacity duration-100',
  secondary:
    'text-black dark:text-white hover:bg-gray-200 dark:bg-polar-700 dark:hover:bg-polar-600 bg-gray-100 border dark:border-white/5 border-black/4',
  ghost:
    'bg-transparent hover:bg-gray-200 dark:hover:bg-polar-700 text-black dark:text-white',
} as const

const sizeClasses = {
  default: 'h-10 px-5 py-3 text-sm',
  sm: 'h-8 px-3 py-1.5 text-xs',
  lg: 'h-12 px-5 py-4 text-sm',
  icon: 'flex items-center justify-center aspect-square p-2 text-sm',
} as const

export type ButtonProps = React.ComponentProps<'button'> & {
  variant?: keyof typeof variantClasses
  size?: keyof typeof sizeClasses
  wrapperClassNames?: string
  loading?: boolean
}

const Button = ({
  className,
  wrapperClassNames,
  variant = 'default',
  size = 'default',
  loading,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) => {
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <>
          <div className="absolute inset-0 flex h-full w-full items-center justify-center">
            <LoadingSpinner disabled={disabled} size={size} />
          </div>
          <span className="flex flex-row items-center opacity-0">
            {children}
          </span>
        </>
      ) : (
        <div className={cn('flex flex-row items-center', wrapperClassNames)}>
          {children}
        </div>
      )}
    </button>
  )
}

Button.displayName = 'Button'

export { Button }

const LoadingSpinner = ({
  disabled,
  size,
}: {
  disabled?: boolean
  size: NonNullable<ButtonProps['size']>
}) => {
  const classes = cn(
    disabled ? 'opacity-40' : '',
    size === 'lg' ? 'h-4 w-4' : 'h-2 w-2',
    'animate-spin',
  )

  return (
    <div role="status">
      <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={classes}
      >
        <path
          d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
          className="fill-current"
        ></path>
      </svg>
    </div>
  )
}
