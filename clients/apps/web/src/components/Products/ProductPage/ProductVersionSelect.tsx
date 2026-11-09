import { useIsManagedAsCode } from '@/hooks/permissions'
import { useSelectedProducts } from '@/hooks/queries/products'
import { schemas } from '@polar-sh/client'
import { CatalogVersionSelect } from '../CatalogVersionSelect'

export const ProductVersionSelect = ({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
}) => {
  const managedAsCode = useIsManagedAsCode(organization.id)
  const { data: versions } = useSelectedProducts(
    {
      organization_id: organization.id,
      external_id:
        managedAsCode && product.external_id ? [product.external_id] : [],
    },
    { includeAllVersions: true },
  )

  return (
    <CatalogVersionSelect
      organization={organization}
      versions={versions}
      selectedId={product.id}
      basePath={`/dashboard/${organization.slug}/products`}
    />
  )
}
