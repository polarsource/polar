import {
  DocumentationPageSidebar,
  MainNavigation,
  MobileNav,
} from '@/components/Documentation/Navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileNav activeSection="contribute">
        <MainNavigation />
      </MobileNav>
      <div className="hidden md:block">
        <DocumentationPageSidebar activeSection="contribute" />
      </div>
      {children}
    </>
  )
}
