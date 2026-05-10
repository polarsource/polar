import Button from '@polar-sh/ui/components/atoms/Button'
import { ButtonProps } from '@polar-sh/ui/components/ui/button'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actions?: ButtonProps[]
}

export const EmptyState = ({
  icon,
  title,
  description,
  actions,
}: EmptyStateProps) => {
  return (
    <div className="dark:border-polar-700 flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 p-12">
      <div className="dark:text-polar-500 text-5xl text-gray-500">{icon}</div>
      <div className="flex flex-col items-center text-center">
        <h3 className="dark:text-polar-50 text-lg text-gray-900">{title}</h3>
        <p className="dark:text-polar-500 text-gray-500">{description}</p>
      </div>
      <div className="mt-4 flex flex-row gap-x-4">
        {actions?.map((action, index) => (
          <Button key={index} {...action} />
        ))}
      </div>
    </div>
  )
}
