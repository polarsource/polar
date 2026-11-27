import { CatalogVersionSelect } from '@/components/Products/CatalogVersionSelect'
import { useMeters } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'

export const MeterVersionSelect = ({
  organization,
  meter,
}: {
  organization: schemas['Organization']
  meter: schemas['Meter']
}) => {
  const managedAsCode =
    organization.feature_settings?.config_as_code_enabled ?? false
  const { data: versions } = useMeters(
    managedAsCode && meter.external_id ? organization.id : undefined,
    {
      external_id: meter.external_id ?? undefined,
      catalog_status: ['live', 'archived', 'draft'],
      limit: 100,
    },
  )

  return (
    <CatalogVersionSelect
      organization={organization}
      versions={versions?.items}
      selectedId={meter.id}
      basePath={`/dashboard/${organization.slug}/products/meters`}
    />
  )
}
