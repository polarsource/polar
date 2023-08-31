'use client'

import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import BackerLayout from '@/components/Layout/BackerLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Gatekeeper>
      <BackerLayout>
        <>{children}</>
      </BackerLayout>
    </Gatekeeper>
  )
}
