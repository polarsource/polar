import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { VoidSignalListSidebar } from '@/components/Void/VoidSignalListSidebar'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <MasterDetailLayout listView={<VoidSignalListSidebar />}>
      {children}
    </MasterDetailLayout>
  )
}
