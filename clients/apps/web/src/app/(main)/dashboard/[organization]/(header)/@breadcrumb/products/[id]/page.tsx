import { getServerSideAPI } from '@/utils/api/serverside'
import { getProductById } from '@/utils/product'
import {
  BreadcrumbPageParams,
  BreadcrumbSeparator,
  CopyableBreadcrumbLink,
} from '../../Breadcrumb'

export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams & { id: string }
}) {
  const api = await getServerSideAPI()
  const product = await getProductById(api, params.id)
  return (
    <>
      <BreadcrumbSeparator />
      <CopyableBreadcrumbLink
        href={`/dashboard/${params.organization}/products/${product.id}`}
        text={product.id}
      >
        {product.id}
      </CopyableBreadcrumbLink>
    </>
  )
}
