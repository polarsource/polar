import { cva } from 'class-variance-authority'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ButtonProps, Button as ShadcnButton } from '../button'

const buttonVariants = cva(
  'relative font-normal inline-flex items-center justify-center rounded-lg text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-blue-500 text-white dark:border dark:border-blue-400 hover:bg-blue-400',
        destructive:
          'bg-red-500 dark:bg-red-600 text-white dark:border dark:border-red-500 hover:bg-red-400 dark:hover:bg-red-500',
        outline:
          'text-blue-500 dark:text-polar-200 hover:bg-blue-50 dark:bg-transparent dark:hover:bg-polar-600 border-transparent hover:border-blue-100 border dark:border-polar-600 bg-transparent border-blue-100',
        secondary:
          'text-blue-500 dark:text-polar-200 hover:bg-blue-50 dark:bg-polar-700 dark:hover:bg-polar-600 border-transparent hover:border-blue-100 border dark:border-polar-600 bg-transparent border-blue-100',
        ghost:
          'text-blue-500 dark:text-blue-400 bg-transparent hover:bg-transparent dark:hover:bg-transparent',
        link: 'text-blue-400 underline-offset-4 hover:underline bg-transparent hover:bg-transparent',
      },
      size: {
        default: 'h-9 px-4 py-1.5 rounded-lg text-sm',
        sm: 'h-7 rounded-md px-3 py-1.5 text-xs',
        lg: 'h-10 rounded-lg px-5 py-4 text-sm',
        icon: 'flex items-center justify-center h-8 h-8 p-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { loading?: boolean; fullWidth?: boolean }
>(
  (
    { className, variant, size, loading, fullWidth, children, ...props },
    ref,
  ) => {
    return (
      <ShadcnButton
        className={twMerge(
          buttonVariants({ variant, size, className }),
          fullWidth ? 'w-full' : '',
        )}
        ref={ref}
        {...props}
      >
        {loading ? (
          <>
            <div className="absolute inset-0 flex h-full w-full items-center justify-center">
              <LoadingSpinner disabled={props.disabled} size={size} />
            </div>
            <span className="flex flex-row items-center opacity-0">
              {children}
            </span>
          </>
        ) : (
          <div className="flex flex-row items-center">{children}</div>
        )}
      </ShadcnButton>
    )
  },
)

Button.displayName = ShadcnButton.displayName

export default Button

const LoadingSpinner = (props: {
  disabled?: boolean
  size: ButtonProps['size']
}) => {
  const classes = twMerge(
    props.disabled ? 'fill-white text-white/20' : 'fill-white text-blue-300',
    props.size === 'default' || 'large' ? 'h-4 w-4' : 'h-2 w-2',
    'animate-spin',
  )

  return (
    <>
      <div role="status">
        <svg
          aria-hidden="true"
          className={classes}
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill"
          />
        </svg>
      </div>
    </>
  )
}

export const RawButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <ShadcnButton
        className={twMerge(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </ShadcnButton>
    )
  },
)
