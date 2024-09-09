import DashboardLayout from '@/components/Layout/DashboardLayout'
import ClientLayout from './ClientLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout className="flex h-full flex-grow">
      <ClientLayout>{children}</ClientLayout>
    </DashboardLayout>
  )
}
