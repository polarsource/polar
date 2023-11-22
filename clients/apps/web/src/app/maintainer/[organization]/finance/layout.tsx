import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardTopbar isFixed useOrgFromURL />
      <DashboardBody>{children}</DashboardBody>
    </>
  )
}
