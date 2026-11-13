import { useCatalogVersionLabels } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Pill } from '@polar-sh/orbit'
import { History } from '@polar-sh/orbit/icons'
import { CatalogVersion } from './CatalogVersionSelect'

export const CatalogVersionLabel = ({
  organization,
  version,
  label,
}: {
  organization: schemas['Organization']
  version: Pick<CatalogVersion, 'catalog_id' | 'is_current'>
  label?: string
}) => {
  // Every table row calls this, but React Query sends one request per organization and all rows share it.
  const { data: labels } = useCatalogVersionLabels(organization)
  const catalog = version.catalog_id && labels?.get(version.catalog_id)
  if (
    version.is_current ||
    !organization.feature_settings?.config_as_code_enabled ||
    !catalog ||
    catalog.status !== 'archived' ||
    !catalog.name
  ) {
    return null
  }
  return (
    <Pill
      color="gray"
      className="shrink-0 space-x-1 rounded-sm py-0.5 pr-1.5 pl-1 font-normal"
    >
      <History size={12} aria-hidden />
      <span>{label ?? catalog.name}</span>
    </Pill>
  )
}
