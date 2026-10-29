import { useCatalogVersionLabels } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Pill } from '@polar-sh/orbit'

export const ProductVersionLabel = ({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: { catalog_id?: string | null }
}) => {
  // Every table row calls this, but React Query sends one request per organization and all rows share it.
  const { data: labels } = useCatalogVersionLabels(organization)
  const catalog = product.catalog_id && labels?.get(product.catalog_id)
  if (!catalog || catalog.status !== 'archived' || !catalog.name) {
    return null
  }
  return (
    <>
      {' '}
      <Pill
        color="gray"
        className="text-xxs! ml-1 rounded-sm px-2 py-0.5 font-normal"
      >
        {catalog.name}
      </Pill>
    </>
  )
}
