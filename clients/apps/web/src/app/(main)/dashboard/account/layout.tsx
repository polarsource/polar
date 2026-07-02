import DashboardLayout, {
  DashboardBody,
} from '@/components/Layout/DashboardLayout'
import { SidebarProvider } from '@polar-sh/ui/components/ui/sidebar'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider open>
      <DashboardLayout type="account">
        <DashboardBody wrapperClassName="md:gap-y-8 max-w-(--breakpoint-sm)!">
          <div className="flex flex-col gap-y-12">{children}</div>
        </DashboardBody>
      </DashboardLayout>
    </SidebarProvider>
  )
}
