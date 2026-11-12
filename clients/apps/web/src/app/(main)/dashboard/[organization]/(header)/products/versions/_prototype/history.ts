// PROTOTYPE: removed-entities exploration for the versions page. Throwaway.
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Change, diffItems, Line } from '../[id]/diff'
import { productFields, valueFormatter } from '../[id]/format'

type Catalog = schemas['Catalog']
type Config = schemas['ConfigExportDocument']
type Item = { external_id: string; deprecated?: boolean | null } & Record<
  string,
  unknown
>

export type Kind = 'product' | 'benefit'
// retired = out of the live catalog, but customers still use it
export type Status = 'live' | 'retired' | 'removed'
export type Step = { change: Change | 'same'; lines: Line[]; item: Item }
export type Version = { catalog: Catalog; config: Config }
export type Entity = {
  kind: Kind
  key: string
  name: string
  steps: (Step | null)[]
  status: Status
  customers: number | null
  firstIndex: number
  lastIndex: number
}

const sections: Record<
  Kind,
  { nameField: string; items: (config: Config) => Item[] }
> = {
  product: {
    nameField: 'name',
    items: (config) => config.products.map(productFields) as Item[],
  },
  benefit: {
    nameField: 'description',
    items: (config) => config.benefits as Item[],
  },
}

export const nameField = (kind: Kind) => sections[kind].nameField

export const buildHistory = (
  versions: Version[],
  customers: Map<string, number>,
): Entity[] => {
  const live =
    versions.findLast(({ catalog }) => catalog.status === 'live') ??
    versions.at(-1)
  const entities = new Map<string, Entity>()

  for (const kind of ['product', 'benefit'] as const) {
    const { nameField, items } = sections[kind]
    versions.forEach((version, index) => {
      const before = index ? items(versions[index - 1].config) : []
      const { entries, unchanged } = diffItems(
        before,
        items(version.config),
        nameField,
      )
      const record = (key: string, step: Step) => {
        const id = `${kind}:${key}`
        const entity = entities.get(id) ?? {
          kind,
          key,
          name: '',
          steps: versions.map(() => null),
          status: 'removed' as Status,
          customers: null,
          firstIndex: index,
          lastIndex: index,
        }
        entity.name = String(step.item[nameField])
        entity.steps[index] = step
        entity.lastIndex = index
        entities.set(id, entity)
      }
      for (const { key, item, change, lines } of entries) {
        if (change !== 'removed') record(key, { change, lines, item })
      }
      for (const item of unchanged) {
        record(item.external_id, { change: 'same', lines: [], item })
      }
    })
  }

  for (const entity of entities.values()) {
    const current = live
      ? sections[entity.kind]
          .items(live.config)
          .find((item) => item.external_id === entity.key)
      : undefined
    // Only in the draft counts as in the catalog, not removed
    const inLatest = !!entity.steps.at(-1)
    entity.status = !current
      ? inLatest
        ? 'live'
        : 'removed'
      : current.deprecated
        ? 'retired'
        : 'live'
    // Retired items are only exported as their last version; use it for the name
    if (current?.deprecated) {
      entity.name = String(current[sections[entity.kind].nameField])
    }
    entity.customers = customers.get(`${entity.kind}:${entity.key}`) ?? null
  }

  return [...entities.values()]
}

const exportQuery = (organizationId: string, catalogId: string) => ({
  queryKey: ['catalogs', 'config', { id: catalogId }],
  queryFn: () =>
    unwrap(
      api.GET('/v1/config/', {
        params: {
          query: { organization_id: organizationId, catalog_id: catalogId },
        },
      }),
    ),
})

export const useVersionHistory = (organization: schemas['Organization']) => {
  const { data: catalogs } = useQuery({
    queryKey: ['catalogs', 'prototype-all', { id: organization.id }],
    queryFn: async () => {
      const data = await unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: {
              organization_id: organization.id,
              status: ['live', 'archived', 'draft'],
              limit: 100,
            },
          },
        }),
      )
      return data.items.toReversed()
    },
  })
  const exports = useQueries({
    queries: (catalogs ?? []).map((catalog) =>
      exportQuery(organization.id, catalog.id),
    ),
  })
  const liveIndex = catalogs?.findIndex(({ status }) => status === 'live') ?? -1
  const liveConfig = exports[liveIndex]?.data?.config
  const { data: prune } = useQuery({
    queryKey: ['prototype-prune', { id: catalogs?.[liveIndex]?.id }],
    queryFn: () =>
      unwrap(
        api.POST('/v1/config/prune', {
          body: {
            ...liveConfig,
            organization_id: organization.id,
          } as schemas['Config'],
        }),
      ),
    enabled: !!liveConfig,
  })

  if (!catalogs || exports.some(({ data }) => !data)) return null

  const versions = catalogs.map((catalog, index) => ({
    catalog,
    config: exports[index].data!.config,
  }))
  const customers = new Map(
    (prune?.entries ?? []).map((entry) => [
      `${entry.resource}:${entry.external_id}`,
      entry.customers_count,
    ]),
  )
  return {
    versions,
    entities: buildHistory(versions, customers),
    format: valueFormatter(versions.map(({ config }) => config)),
  }
}

export type History = NonNullable<ReturnType<typeof useVersionHistory>>

export const versionLabel = (versions: Version[], index: number) => {
  const { catalog } = versions[index]
  return catalog.status === 'draft'
    ? 'Draft'
    : (catalog.name ?? `v${index + 1}`)
}
