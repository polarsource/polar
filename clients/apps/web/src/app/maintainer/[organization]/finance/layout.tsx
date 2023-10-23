import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardTopbar isFixed useOrgFromURL />
      <DashboardBody>{children}</DashboardBody>
    </>
  )
}
