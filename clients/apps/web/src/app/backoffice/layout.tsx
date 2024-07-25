import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Navigation/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardTopbar />
      <DashboardBody>{children}</DashboardBody>
    </>
  )
}
