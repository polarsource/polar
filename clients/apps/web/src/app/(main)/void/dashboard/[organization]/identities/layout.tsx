import { VoidIdentityListSidebar } from '@/components/Void/Identities/VoidIdentityListSidebar'
import { MasterDetailLayout } from '@/components/Layout/MasterDetailLayout'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <MasterDetailLayout listView={<VoidIdentityListSidebar />}>
      {children}
    </MasterDetailLayout>
  )
}
