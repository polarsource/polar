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
          'bg-blue-500 text-white hover:opacity-85 transition-opacity duration-100 border border-white/10',
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
