'use client'

import DashboardLayout from '@/components/Layout/DashboardLayout'
import { FullscreenOverlay } from '@/components/Modal/FullscreenOverlay'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function Layout({
  children,
  params: { organization },
}: {
  children: React.ReactNode
  params: { organization: string }
}) {
  const router = useRouter()

  return (
    <DashboardLayout className="flex h-full flex-grow">
      <FullscreenOverlay
        isShown={true}
        modalContent={children}
        hide={() => {
          router.push(`/dashboard/${organization}`)
        }}
      />
    </DashboardLayout>
  )
}
