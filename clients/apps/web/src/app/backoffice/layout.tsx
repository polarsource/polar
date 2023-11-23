import DashboardLayout, {
  DashboardBody,
} from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardLayout>
        <DashboardTopbar useOrgFromURL={false} hideProfile={false} isFixed />
        <DashboardBody>{children}</DashboardBody>
      </DashboardLayout>
    </>
  )
}
