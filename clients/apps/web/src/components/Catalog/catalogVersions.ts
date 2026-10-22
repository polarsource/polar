import { schemas } from '@polar-sh/client'

export interface CatalogVersion {
  catalog: schemas['Catalog']
  label: string
  shortHash: string
}

const publishedTime = (catalog: schemas['Catalog']) =>
  new Date(catalog.published_at).getTime()

/** The vN label is only a display name, the version hash is the identity. */
export const catalogVersions = (
  catalogs: schemas['Catalog'][],
): CatalogVersion[] =>
  catalogs
    .toSorted((a, b) => publishedTime(a) - publishedTime(b))
    .map((catalog, index) => ({
      catalog,
      label: `v${index + 1}`,
      shortHash: catalog.version_hash.slice(0, 7),
    }))
    .toReversed()
