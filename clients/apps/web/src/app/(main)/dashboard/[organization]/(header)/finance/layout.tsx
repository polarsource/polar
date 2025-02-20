import { DashboardBody } from '@/components/Layout/DashboardLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardBody wide>{children}</DashboardBody>
}
