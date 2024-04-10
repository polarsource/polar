import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout className="dark:bg-polar-900 bg-white">
      <>{children}</>
    </DashboardLayout>
  )
}
