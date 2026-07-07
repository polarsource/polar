'use client'

import { cn } from '@polar-sh/ui/lib/utils'

interface CheckoutBannerProps {
  title: string
  description?: string
  className?: string
}

export const CheckoutBanner = ({
  title,
  description,
  className,
}: CheckoutBannerProps) => {
  return (
    <div
      className={cn(
        'dark:border-polar-700 dark:bg-polar-800 flex w-full flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left',
        className,
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="dark:text-polar-400 text-sm text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}
