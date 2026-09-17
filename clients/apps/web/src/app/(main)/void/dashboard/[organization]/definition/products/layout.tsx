import { VoidProductListSidebar } from '@/components/Void/VoidProductListSidebar'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <MasterDetailLayout listView={<VoidProductListSidebar />}>
      {children}
    </MasterDetailLayout>
  )
}
