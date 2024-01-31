import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <Gatekeeper>
      <>{children}</>
    </Gatekeeper>
  )
}
