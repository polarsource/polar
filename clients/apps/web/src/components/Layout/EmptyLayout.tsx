import { PropsWithChildren } from 'react'

const EmptyLayout = ({ children }: PropsWithChildren) => {
  return <div className="flex h-full min-h-screen flex-col">{children}</div>
}

export default EmptyLayout
