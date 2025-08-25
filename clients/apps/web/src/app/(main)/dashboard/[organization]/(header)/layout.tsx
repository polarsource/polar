import ImpersonationBanner from '@/components/Impersonation/ImpersonationBanner'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { SidebarProvider } from '@polar-sh/ui/components/ui/sidebar'
import { cookies } from 'next/headers'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get('sidebar_state')?.value === 'false'

  return (
    <>
      <ImpersonationBanner />
      <SidebarProvider defaultOpen={!defaultCollapsed}>
        <DashboardLayout>{children}</DashboardLayout>
      </SidebarProvider>
    </>
  )
}
