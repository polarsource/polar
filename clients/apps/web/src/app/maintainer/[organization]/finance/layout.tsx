import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardLayout showSidebar={true}>{children}</DashboardLayout>
    </>
  )
}
