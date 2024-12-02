import {
  DocumentationPageSidebar,
  MainNavigation,
  MobileNav,
  SDKNavigation,
} from '@/components/Documentation/Navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileNav activeSection="sdk">
        <MainNavigation />
      </MobileNav>
      <DocumentationPageSidebar activeSection="sdk">
        <SDKNavigation />
      </DocumentationPageSidebar>
      {children}
    </>
  )
}
