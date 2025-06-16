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
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <DashboardLayout type="account">
        <DashboardBody wrapperClassName="md:gap-y-8 !max-w-screen-sm">
          <div className="flex flex-col gap-y-12">{children}</div>
        </DashboardBody>
      </DashboardLayout>
    </SidebarProvider>
  )
}
