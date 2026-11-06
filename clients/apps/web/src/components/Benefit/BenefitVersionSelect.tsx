import { useIsManagedAsCode } from '@/hooks/permissions'
import { useBenefits } from '@/hooks/queries/benefits'
import { schemas } from '@polar-sh/client'
import { CatalogVersionSelect } from '../Products/CatalogVersionSelect'

export const BenefitVersionSelect = ({
  organization,
  benefit,
}: {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
}) => {
  const managedAsCode = useIsManagedAsCode(organization.id)
  const { data: versions } = useBenefits(
    managedAsCode && benefit.external_id ? organization.id : undefined,
    {
      external_id: benefit.external_id ?? undefined,
      catalog_status: ['live', 'archived'],
      limit: 100,
    },
  )

  return (
    <CatalogVersionSelect
      organization={organization}
      versions={versions?.items}
      selectedId={benefit.id}
      basePath={`/dashboard/${organization.slug}/products/benefits`}
    />
  )
}
