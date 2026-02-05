import { ButtonProps, Button as ShadcnButton } from '@/components/ui/button'
import { cva } from 'class-variance-authority'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva(
  'relative font-normal inline-flex items-center cursor-pointer font-medium select-none justify-center rounded-xl text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-white hover:opacity-85 transition-opacity duration-100 border border-white/10',
        destructive:
          'bg-red-500 dark:bg-red-600 text-white hover:bg-red-400 dark:hover:bg-red-500',
        outline:
          'text-black dark:text-white hover:bg-gray-200 dark:bg-transparent dark:hover:bg-polar-700 border-transparent hover:border-gray-200 border dark:border-polar-700 bg-transparent border-gray-100',
        secondary:
          'text-black dark:text-white hover:bg-gray-200 dark:bg-polar-700 dark:hover:bg-polar-600 bg-gray-100 border dark:border-white/5 border-black/4',
        underline:
          'text-black dark:text-white bg-transparent border-b hover:border-black dark:hover:border-white border-transparent transition-colors duration-300 p-0! hover:bg-transparent rounded-none!',
        link: 'text-blue-400 underline-offset-4 hover:underline bg-transparent hover:bg-transparent',
        ghost:
          'bg-transparent hover:bg-gray-200 dark:hover:bg-polar-700 dark:bg-transparent text-black dark:text-white',
      },
      size: {
        default: 'h-10 px-4 py-2 rounded-xl text-sm',
        sm: 'h-8 rounded-lg px-3 py-1.5 text-xs',
        lg: 'h-12 rounded-2xl px-5 py-4 text-sm',
        icon: 'flex items-center justify-center h-8 w-8 p-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const Button = ({
  ref,
  className,
  wrapperClassNames,
  variant,
  size,
  loading,
  fullWidth,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps & {
  ref?: React.RefObject<HTMLButtonElement>
  wrapperClassNames?: string
  loading?: boolean
  fullWidth?: boolean
}) => {
  return (
    <ShadcnButton
      className={twMerge(
        buttonVariants({ variant, size, className }),
        fullWidth ? 'w-full' : '',
      )}
      ref={ref}
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
        <div
          className={twMerge('flex flex-row items-center', wrapperClassNames)}
        >
          {children}
        </div>
      )}
    </ShadcnButton>
  )
}

Button.displayName = ShadcnButton.displayName

export default Button

const LoadingSpinner = (props: {
  disabled?: boolean
  size: ButtonProps['size']
}) => {
  const classes = twMerge(
    props.disabled ? 'opacity-40' : '',
    props.size === 'lg' ? 'h-4 w-4' : 'h-2 w-2',
    'animate-spin',
  )

  return (
    <>
      <div role="status">
        <svg
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className={classes}
        >
          <path
            d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
            className="text-current"
          ></path>
        </svg>
      </div>
    </>
  )
}

export const RawButton = ({
  ref,
  className,
  variant,
  size,
  children,
  ...props
}: ButtonProps & {
  ref?: React.RefObject<HTMLButtonElement>
}) => {
  return (
    <ShadcnButton
      className={twMerge(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      {children}
    </ShadcnButton>
  )
}

RawButton.displayName = 'RawButton'

export type { ButtonProps }
