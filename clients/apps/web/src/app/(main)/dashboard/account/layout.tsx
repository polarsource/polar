import DashboardLayout, {
  DashboardBody,
} from '@/components/Layout/DashboardLayout'
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
    <SidebarProvider defaultOpen={!defaultCollapsed}>
      <DashboardLayout type="account">
        <DashboardBody wrapperClassName="md:gap-y-8 max-w-(--breakpoint-sm)!">
          <div className="flex flex-col gap-y-12">{children}</div>
        </DashboardBody>
      </DashboardLayout>
    </SidebarProvider>
  )
}
