import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { VoidMeterListSidebar } from '@/components/Void/VoidMeterListSidebar'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <MasterDetailLayout listView={<VoidMeterListSidebar />}>
      {children}
    </MasterDetailLayout>
  )
}
