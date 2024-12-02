import {
  DocumentationPageSidebar,
  MainNavigation,
  MobileNav,
  SupportNavigation,
} from '@/components/Documentation/Navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileNav activeSection="support">
        <MainNavigation />
      </MobileNav>
      <DocumentationPageSidebar activeSection="support">
        <SupportNavigation />
      </DocumentationPageSidebar>
      {children}
    </>
  )
}
