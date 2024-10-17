import Gatekeeper from '@/components/Gatekeeper/Gatekeeper'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <Gatekeeper>
      <>{children}</>
    </Gatekeeper>
  )
}
