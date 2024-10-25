import {
  BreadcrumbLink,
  BreadcrumbPageParams,
  BreadcrumbSeparator,
} from '../../Breadcrumb'

export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams
}) {
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbLink href={`/dashboard/${params.organization}/products/new`}>
        Create Product
      </BreadcrumbLink>
    </>
  )
}
