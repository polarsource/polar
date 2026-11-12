'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { useSelectedLayoutSegment } from 'next/navigation'
import { PropsWithChildren, ReactNode } from 'react'

export const VersionsLayout = ({
  listView,
  children,
}: PropsWithChildren<{ listView: ReactNode }>) => {
  if (useSelectedLayoutSegment() === 'removed') {
    return <DashboardBody title="Removed keys">{children}</DashboardBody>
  }
  return <MasterDetailLayout listView={listView}>{children}</MasterDetailLayout>
}
