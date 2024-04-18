import { PropsWithChildren } from 'react'
import ClientLayout from './ClientLayout'

export default function Layout({ children }: PropsWithChildren) {
  return <ClientLayout>{children}</ClientLayout>
}
