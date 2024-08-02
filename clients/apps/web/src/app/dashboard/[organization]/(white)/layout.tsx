import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout className="bg-white dark:bg-transparent">
      <>{children}</>
    </DashboardLayout>
  )
}
