'use client'

import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import DashboardLayout, {
  DashboardBody,
} from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Gatekeeper>
      <DashboardLayout>
        <DashboardTopbar isFixed useOrgFromURL />
        <DashboardBody>{children}</DashboardBody>
      </DashboardLayout>
    </Gatekeeper>
  )
}
