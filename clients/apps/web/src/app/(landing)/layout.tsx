import { PropsWithChildren, useEffect } from 'react'
import ClientLayout from './ClientLayout'

export default function Layout({ children }: PropsWithChildren) {
  useEffect(() => {
    window.scroll(0, 0)
  }, [])

  return <ClientLayout>{children}</ClientLayout>
}
