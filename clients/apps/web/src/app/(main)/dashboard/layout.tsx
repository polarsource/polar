
import { PropsWithChildren } from 'react'

export default async function Layout({ children }: PropsWithChildren) {
  return (
      <div className="md:h-screen h-full flex flex-col">
        {children}
      </div>
  )
}
