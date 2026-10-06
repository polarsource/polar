import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { VoidReducerListSidebar } from '@/components/Void/VoidReducerListSidebar'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <MasterDetailLayout listView={<VoidReducerListSidebar />}>
      {children}
    </MasterDetailLayout>
  )
}
