import {
  DocumentationPageSidebar,
  MainNavigation,
  MobileNav,
} from '@/components/Documentation/Navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileNav activeSection="support">
        <MainNavigation />
      </MobileNav>
      <div className="hidden md:block">
        <DocumentationPageSidebar activeSection="support" />
      </div>
      {children}
    </>
  )
}
