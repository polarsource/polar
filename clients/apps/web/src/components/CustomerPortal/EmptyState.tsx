import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
}

export const EmptyState = ({ icon, title, description }: EmptyStateProps) => {
  return (
    <div className="dark:border-polar-700 flex flex-col items-center justify-center gap-2 rounded-3xl border border-gray-200 p-12">
      <div className="dark:text-polar-500 text-5xl text-gray-500">{icon}</div>
      <div className="flex flex-col items-center text-center">
        <h3 className="dark:text-polar-50 text-lg text-gray-900">{title}</h3>
        <p className="dark:text-polar-500 text-gray-500">{description}</p>
      </div>
    </div>
  )
}
