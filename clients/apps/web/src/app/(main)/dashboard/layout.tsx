import { PropsWithChildren } from 'react'

export default async function Layout({ children }: PropsWithChildren) {
  return <div className="flex h-full flex-col md:h-screen">{children}</div>
}
