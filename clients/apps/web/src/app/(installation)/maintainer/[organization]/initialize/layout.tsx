'use client'

import Topbar from '@/components/Shared/Topbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar hideProfile={true} />
      {children}
    </>
  )
}
