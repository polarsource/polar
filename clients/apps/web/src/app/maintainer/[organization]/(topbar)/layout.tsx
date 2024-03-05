import DashboardLayout from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Navigation/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <DashboardTopbar isFixed useOrgFromURL />
      <>{children}</>
    </DashboardLayout>
  )
}
