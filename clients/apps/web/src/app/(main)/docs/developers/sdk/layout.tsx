import {
  DocumentationPageSidebar,
  SDKNavigation,
  MainNavigation,
  MobileNav,
} from '@/components/Documentation/Navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileNav activeSection="sdk">
        <MainNavigation />
      </MobileNav>
      <div className="hidden md:block">
        <DocumentationPageSidebar activeSection="sdk">
          <SDKNavigation />
        </DocumentationPageSidebar>
      </div>
      {children}
    </>
  )
}
