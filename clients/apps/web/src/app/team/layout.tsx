import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import BackerLayout from '@/components/Layout/BackerLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Gatekeeper>
      <BackerLayout>
        <DashboardTopbar isFixed useOrgFromURL />
        {children}
      </BackerLayout>
    </Gatekeeper>
  )
}
