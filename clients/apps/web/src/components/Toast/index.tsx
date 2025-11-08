import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, VariantProps } from 'class-variance-authority'
import { XIcon } from 'lucide-react'
import * as React from 'react'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = ({
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Viewport>) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className="fixed top-0 z-100 flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:right-4 sm:bottom-4 sm:flex-col sm:p-0 md:right-10 md:bottom-10 md:max-w-[420px]"
    {...props}
  />
)
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  'data-[swipe=move]:transition-none group relative pointer-events-auto flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl p-4 pl-5 pr-8 shadow-xl transition-all data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full',
  {
    variants: {
      variant: {
        default:
          'bg-white dark:bg-polar-900 border border-transparent dark:border-polar-700',
        error:
          'bg-white dark:bg-polar-900 border border-transparent dark:border-polar-700',
        success:
          'bg-white dark:bg-polar-900 border border-transparent dark:border-polar-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const Toast = ({
  ref,
  variant,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants>) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={toastVariants({ variant })}
      {...props}
    />
  )
}
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = ({
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Action>) => (
  <ToastPrimitives.Action
    ref={ref}
    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-100 px-3 text-sm font-medium transition-colors group-[.error]:border-red-200 group-[.error]:bg-red-100 group-[.success]:border-green-200 group-[.success]:bg-green-100 hover:bg-gray-200/75 group-[.error]:hover:bg-red-200/50 group-[.success]:hover:bg-green-200/50 disabled:pointer-events-none disabled:opacity-50"
    {...props}
  />
)
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = ({
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Close>) => (
  <ToastPrimitives.Close
    ref={ref}
    className="absolute top-2 right-2 rounded-md p-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 group-[.error]:text-red-500 group-[.success]:text-green-500 hover:text-gray-600 group-[.error]:hover:text-red-700 group-[.success]:hover:text-green-700 focus:opacity-100"
    toast-close=""
    {...props}
  >
    <XIcon className="h-4 w-4" />
  </ToastPrimitives.Close>
)
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = ({
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Title>) => (
  <ToastPrimitives.Title ref={ref} className="text-sm font-medium" {...props} />
)
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = ({
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Description>) => (
  <ToastPrimitives.Description
    ref={ref}
    className="text-sm opacity-80"
    {...props}
  />
)
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastActionElement,
  type ToastProps,
}
