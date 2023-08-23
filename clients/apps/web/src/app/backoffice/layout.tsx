import Topbar from '@/components/Shared/Topbar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar
        customLogoTitle="Backoffice"
        logoPosition="center"
        isFixed={false}
        hideProfile={true}
      ></Topbar>
      <div className="mx-auto max-w-7xl p-4">{children}</div>
    </>
  )
}
