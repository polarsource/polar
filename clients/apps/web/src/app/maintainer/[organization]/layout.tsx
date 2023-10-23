import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import MaintainerLayout from '@/components/Layout/MaintainerLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Gatekeeper>
      <MaintainerLayout>
        <DashboardTopbar isFixed useOrgFromURL />
        <>{children}</>
      </MaintainerLayout>
    </Gatekeeper>
  )
}
