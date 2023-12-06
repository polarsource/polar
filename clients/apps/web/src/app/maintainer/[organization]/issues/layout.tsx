import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Gatekeeper>
      <DashboardLayout>
        <>{children}</>
      </DashboardLayout>
    </Gatekeeper>
  )
}
