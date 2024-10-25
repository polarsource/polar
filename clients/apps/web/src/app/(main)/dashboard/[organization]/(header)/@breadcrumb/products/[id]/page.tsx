import CopyToClipboardButton from '@/components/CopyToClipboardButton/CopyToClipboardButton'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getProductById } from '@/utils/product'
import {
  BreadcrumbLink,
  BreadcrumbPageParams,
  BreadcrumbSeparator,
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
      <BreadcrumbLink
        href={`/dashboard/${params.organization}/products/${product.id}`}
      >
        {product.id}
        <CopyToClipboardButton text={product.id} />
      </BreadcrumbLink>
    </>
  )
}
