import PublicLayout from '@/components/Layout/PublicLayout'
import ClientLayout from './ClientLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout wide>
      <ClientLayout>{children}</ClientLayout>
    </PublicLayout>
  )
}
