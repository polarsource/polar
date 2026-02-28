import { PropsWithChildren, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface WidgetContainerProps {
  title: string
  action?: ReactNode
  className?: string
}

export const WidgetContainer = ({
  title,
  action,
  className,
  children,
}: PropsWithChildren<WidgetContainerProps>) => {
  return (
    <div className={twMerge('flex max-h-96 flex-col gap-6 overflow-hidden', className)}>
      <div className="flex shrink-0 items-center justify-between px-6 pt-6">
        <h3 className="text-lg">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6">{children}</div>
    </div>
  )
}
