import { AuthProvider } from '@/providers/AuthProvider'
import type { PropsWithChildren } from 'react'

export default function AgentLayout({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>
}
