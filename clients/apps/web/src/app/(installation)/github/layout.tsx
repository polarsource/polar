import EmptyLayout from '@/components/Layout/EmptyLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <EmptyLayout>
      <>{children}</>
    </EmptyLayout>
  )
}
