import openapiSchema from '@polar-sh/sdk/openapi'

export type SchemaPaths = (typeof openapiSchema)['paths']
export type SchemaPathKey = keyof SchemaPaths
export type SchemaPathMethods<T extends SchemaPathKey> = SchemaPaths[T]
export type SchemaPathMethod<T extends SchemaPathKey> =
  keyof SchemaPathMethods<T>

type FindMatchingPath<
  A extends string,
  B extends SchemaPathKey = SchemaPathKey,
> = B extends `${infer X}${A}${infer Y}`
  ? A extends string
    ? SchemaPathMethods<B>[SchemaPathMethod<B>]
    : never
  : never

export type APIMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface APIParameter {
  name: string
  description?: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required: false
  schema: {
    anyOf?: {
      type: string
    }[]
    title: string
    type?: string
    format?: string
  }
}
export interface Section {
  name: string
  endpoints: {
    name: string
    path: string
    method: APIMethod
  }[]
}

const extractEntries = <T extends {}>(obj: T) => {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}

const buildSections = (): Section[] => {
  const sections = extractEntries(openapiSchema.paths).reduce<Section[]>(
    (acc, [path, endpoints]) => {
      const [ancestor] = path.replace('/api/v1/', '').split('/').filter(Boolean)

      switch (ancestor) {
        case 'readyz':
        case 'healthz':
        case 'backoffice':
        case '{platform}':
          return acc
      }

      for (const [method, e] of extractEntries(endpoints)) {
        const endpoint = e as FindMatchingPath<typeof path>

        const matchingAncestor = acc.find(
          (section) => section.name === ancestor.replaceAll('_', ' '),
        )

        if (!matchingAncestor) {
          acc.push({
            name: ancestor.replaceAll('_', ' '),
            endpoints: [
              {
                name: endpoint.summary,
                path: path,
                method: method as APIMethod,
              },
            ],
          })
        } else {
          matchingAncestor.endpoints.push({
            name: endpoint.summary,
            path: path,
            method: method as APIMethod,
          })
        }
      }

      return acc
    },
    [],
  )

  return sections.sort((a, b) => a.name.localeCompare(b.name))
}

export const sections = buildSections()
