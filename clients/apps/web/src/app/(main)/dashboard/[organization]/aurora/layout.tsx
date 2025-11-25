import AuroraDashboardLayout from '@/components/Aurora/DashboardLayout'
import ImpersonationBanner from '@/components/Impersonation/ImpersonationBanner'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ImpersonationBanner />
      <AuroraDashboardLayout>{children}</AuroraDashboardLayout>
    </>
  )
}
