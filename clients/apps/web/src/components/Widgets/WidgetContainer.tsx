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
    <div className={twMerge('flex h-full flex-col gap-6 p-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}
