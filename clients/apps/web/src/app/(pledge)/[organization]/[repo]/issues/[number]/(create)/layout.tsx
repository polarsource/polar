import PublicLayout from '@/components/Layout/PublicLayout'
import TopbarLayout from '@/components/Layout/TopbarLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TopbarLayout logoPosition="center" isFixed={false}>
      <PublicLayout>
        <>{children}</>
      </PublicLayout>
    </TopbarLayout>
  )
}
