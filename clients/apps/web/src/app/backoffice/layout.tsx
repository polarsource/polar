import DashboardLayout, {
  DashboardBody,
} from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Navigation/DashboardTopbar'
import { DashboardLayoutContextProvider } from '../maintainer/Providers'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardLayoutContextProvider probablyIsMDOrLarger={true}>
        <DashboardLayout>
          <DashboardTopbar useOrgFromURL={false} hideProfile={false} isFixed />
          <DashboardBody>{children}</DashboardBody>
        </DashboardLayout>
      </DashboardLayoutContextProvider>
    </>
  )
}
