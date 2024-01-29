'use client'

import PublicLayout from '@/components/Layout/PublicLayout'
import Topbar from '@/components/Shared/Topbar'
import { useAuth } from '@/hooks'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth()

  return (
    <div className="flex flex-col gap-y-8">
      <Topbar />
      <PublicLayout showUpsellFooter={!authenticated} wide>
        <div className="relative flex min-h-screen w-full flex-col">
          {children}
        </div>
      </PublicLayout>
    </div>
  )
}
