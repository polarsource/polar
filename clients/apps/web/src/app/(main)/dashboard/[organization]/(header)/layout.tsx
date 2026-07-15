import ImpersonationBanner from '@/components/Impersonation/ImpersonationBanner'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { SidebarProvider } from '@polar-sh/ui/components/ui/sidebar'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ImpersonationBanner />
      <SidebarProvider open>
        <DashboardLayout>{children}</DashboardLayout>
      </SidebarProvider>
    </>
  )
}
