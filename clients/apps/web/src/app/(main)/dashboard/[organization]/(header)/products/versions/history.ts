import { useCatalogConfigs, useCatalogs } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Change, diffItems } from './[id]/diff'
import { productFields } from './[id]/format'

type Catalog = schemas['Catalog']
type Config = schemas['ConfigExportDocument']
type Item = { external_id: string } & Record<string, unknown>

export type Version = { catalog: Catalog; config: Config }
// One step per version: how the item changed in it, or null when it isn't in it
export type Entity = { steps: (Change | 'same' | null)[] }

const sections = [
  {
    kind: 'product',
    nameField: 'name',
    items: (config: Config) => config.products.map(productFields) as Item[],
  },
  {
    kind: 'benefit',
    nameField: 'description',
    items: (config: Config) => config.benefits as Item[],
  },
] as const

export const buildHistory = (versions: Version[]): Entity[] => {
  const entities = new Map<string, Entity>()

  for (const { kind, nameField, items } of sections) {
    versions.forEach((version, index) => {
      const before = index ? items(versions[index - 1].config) : []
      const { entries, unchanged } = diffItems(
        before,
        items(version.config),
        nameField,
      )
      const record = (key: string, change: Change | 'same') => {
        const id = `${kind}:${key}`
        const entity = entities.get(id) ?? { steps: versions.map(() => null) }
        entity.steps[index] = change
        entities.set(id, entity)
      }
      for (const { key, change } of entries) {
        if (change !== 'removed') record(key, change)
      }
      for (const item of unchanged) {
        record(item.external_id, 'same')
      }
    })
  }

  return [...entities.values()]
}

export const PAGE_SIZE = 20

export const useVersionHistory = (
  organization: schemas['Organization'],
  page: number,
) => {
  const { data, isError: listError } = useCatalogs(
    organization.id,
    page,
    PAGE_SIZE,
  )
  const hasOlder = !!data && page < data.pagination.max_page
  // The next page's newest version is the base this page's oldest one diffs against
  const { data: older, isError: olderError } = useCatalogs(
    organization.id,
    page + 1,
    PAGE_SIZE,
    hasOlder,
  )
  const base = older?.items[0]
  const catalogs = [...(data?.items ?? []), ...(base ? [base] : [])]
  const { configs, isError: configsError } = useCatalogConfigs(
    organization.id,
    catalogs.map(({ id }) => id),
  )

  const isError = listError || olderError || configsError
  if (!data || (hasOlder && !older) || configs.some((config) => !config)) {
    return { history: null, isError }
  }

  const versions = catalogs
    .map((catalog, index) => ({ catalog, config: configs[index]! }))
    .toReversed()
  return {
    history: {
      versions,
      entities: buildHistory(versions),
      hasBase: !!base,
      totalCount: data.pagination.total_count,
    },
    isError,
  }
}

export type History = NonNullable<
  ReturnType<typeof useVersionHistory>['history']
>
