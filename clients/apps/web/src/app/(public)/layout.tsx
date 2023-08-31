import PublicLayout from '@/components/Layout/PublicLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <>{children}</>
    </PublicLayout>
  )
}
