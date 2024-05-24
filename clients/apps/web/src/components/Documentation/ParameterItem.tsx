import { PropsWithChildren } from 'react'

export const ParameterItem = ({ children }: PropsWithChildren) => {
  return (
    <div className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl bg-gray-50 p-8 shadow-sm">
      {children}
    </div>
  )
}
