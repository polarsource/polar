import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout className="flex h-full flex-grow">
      {children}
    </DashboardLayout>
  )
}
