import {
  APINavigation,
  DocumentationPageSidebar,
  MobileNav,
} from '@/components/Documentation/Navigation'
import { OpenAPIV3_1 } from 'openapi-types'

const APILayout = ({
  openAPISchema,
  activeOperationId,
  children,
}: {
  openAPISchema: OpenAPIV3_1.Document
  activeOperationId?: string
  children: React.ReactNode
}) => {
  return (
    <>
      <MobileNav activeSection="api">
        <APINavigation openAPISchema={openAPISchema} activeOperationId={activeOperationId} />
      </MobileNav>
      <div className="hidden md:block">
        <DocumentationPageSidebar activeSection="api">
          <APINavigation openAPISchema={openAPISchema} activeOperationId={activeOperationId} />
        </DocumentationPageSidebar>
      </div>
      {children}
    </>
  )
}

export default APILayout
