import { useCatalogVersionHashes } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Pill } from '@polar-sh/orbit'

export const ProductVersionLabel = ({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: { is_current?: boolean; catalog_id?: string | null }
}) => {
  const { data: hashes } = useCatalogVersionHashes(organization)
  const hash = product.catalog_id && hashes?.get(product.catalog_id)
  if (product.is_current !== false || !hash) {
    return null
  }
  // The leading space separates it from a name in running text; flex parents drop it.
  return (
    <>
      {' '}
      <Pill
        color="gray"
        className="text-xxs! ml-1 rounded-sm px-2 py-0.5 font-mono font-normal"
      >
        {hash.slice(0, 7)}
      </Pill>
    </>
  )
}
