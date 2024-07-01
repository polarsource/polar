import {
  APINavigation,
  DocumentationPageSidebar,
  MobileNav,
} from '@/components/Documentation/Navigation'
import { fetchSchema } from '@/components/Documentation/openapi'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const openAPISchema = await fetchSchema()
  return (
    <>
      <MobileNav>
        <APINavigation openAPISchema={openAPISchema} />
      </MobileNav>
      <div className="hidden md:block">
        <DocumentationPageSidebar>
          <APINavigation openAPISchema={openAPISchema} />
        </DocumentationPageSidebar>
      </div>
      {children}
    </>
  )
}
