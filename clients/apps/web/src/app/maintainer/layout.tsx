import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Gatekeeper>{children}</Gatekeeper>
    </>
  )
}
