import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function Layout({
  children,
  breadcrumb,
}: {
  children: React.ReactNode
  breadcrumb: React.ReactNode
}) {
  return <DashboardLayout breadcrumb={breadcrumb}>{children}</DashboardLayout>
}
