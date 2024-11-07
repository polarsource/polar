import {
  DocumentationPageSidebar,
  GuidesNavigation,
  ToolsNavigation,
  MainNavigation,
  MobileNav,
} from '@/components/Documentation/Navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileNav activeSection="guides">
        <MainNavigation />
      </MobileNav>
      <div className="hidden md:block">
        <DocumentationPageSidebar activeSection="developers">
          <GuidesNavigation />
          <ToolsNavigation />
        </DocumentationPageSidebar>
      </div>
      {children}
    </>
  )
}
