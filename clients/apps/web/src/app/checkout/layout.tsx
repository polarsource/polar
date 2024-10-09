import PublicLayout from '@/components/Layout/PublicLayout'
import React from 'react'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PublicLayout className="gap-y-0 py-6 md:py-12" wide>
      {children}
    </PublicLayout>
  )
}
