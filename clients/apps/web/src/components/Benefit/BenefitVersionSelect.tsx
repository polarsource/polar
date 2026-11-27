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
  const managedAsCode =
    organization.feature_settings?.config_as_code_enabled ?? false
  const { data: versions } = useBenefits(
    managedAsCode && benefit.external_id ? organization.id : undefined,
    {
      external_id: benefit.external_id ?? undefined,
      catalog_status: ['live', 'archived', 'draft'],
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
