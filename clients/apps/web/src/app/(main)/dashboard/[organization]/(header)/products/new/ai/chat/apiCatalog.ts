type JSONSchema = { [key: string]: unknown }

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface OpenAPIParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  description?: string
  schema?: JSONSchema
}

interface OpenAPIOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OpenAPIParameter[]
  requestBody?: { content?: Record<string, { schema?: JSONSchema }> }
}

export interface OpenAPISpec {
  paths: Record<string, Record<string, OpenAPIOperation>>
  components?: { schemas?: Record<string, JSONSchema> }
}

interface CatalogParameter extends Omit<OpenAPIParameter, 'in'> {
  in: 'path' | 'query'
}

export interface CatalogOperation {
  operationId: string
  method: HttpMethod
  path: string
  summary: string
  description: string
  tags: string[]
  parameters: CatalogParameter[]
  requestBody?: JSONSchema
}

export interface ExecuteInput {
  operationId: string
  pathParams?: Record<string, string>
  query?: Record<string, unknown>
  body?: Record<string, unknown>
}

export interface PreparedRequest {
  method: HttpMethod
  path: string
  params: { path: Record<string, string>; query: Record<string, unknown> }
  body?: Record<string, unknown>
}

export const ALLOWED_OPERATIONS: ReadonlySet<string> = new Set([
  'products:list',
  'products:get',
  'products:create',
  'products:update',
  'products:update_benefits',
  'benefits:list',
  'benefits:get',
  'benefits:create',
  'benefits:update',
  'meters:list',
  'meters:get',
  'meters:create',
  'meters:update',
])

const HTTP_METHODS = new Set(['get', 'post', 'patch', 'put', 'delete'])
const STRIPPED_SCHEMA_KEYS = new Set(['title', 'examples', 'example'])
const MAX_REF_DEPTH = 12
const ORGANIZATION_ID = 'organization_id'

const isObject = (value: unknown): value is JSONSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const dereference = (
  value: unknown,
  schemas: Record<string, JSONSchema>,
  seen: ReadonlySet<string> = new Set(),
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => dereference(item, schemas, seen))
  }
  if (!isObject(value)) {
    return value
  }

  const ref = value.$ref
  if (typeof ref === 'string') {
    const name = ref.split('/').pop() as string
    const target = schemas[name]
    if (!target || seen.has(name) || seen.size >= MAX_REF_DEPTH) {
      return { type: 'object', description: `A ${name} object.` }
    }
    return dereference(target, schemas, new Set([...seen, name]))
  }

  const result: JSONSchema = {}
  for (const [key, child] of Object.entries(value)) {
    if (STRIPPED_SCHEMA_KEYS.has(key)) {
      continue
    }
    if (key === 'properties' && isObject(child)) {
      result.properties = Object.fromEntries(
        Object.entries(child).map(([name, property]) => [
          name,
          dereference(property, schemas, seen),
        ]),
      )
      continue
    }
    result[key] = dereference(child, schemas, seen)
  }
  return result
}

export const buildCatalog = (
  spec: OpenAPISpec,
  allowedOperations: ReadonlySet<string> = ALLOWED_OPERATIONS,
): CatalogOperation[] => {
  const schemas = spec.components?.schemas ?? {}
  const catalog: CatalogOperation[] = []

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation.operationId) {
        continue
      }
      if (!allowedOperations.has(operation.operationId)) {
        continue
      }

      const bodySchema =
        operation.requestBody?.content?.['application/json']?.schema

      catalog.push({
        operationId: operation.operationId,
        method: method.toUpperCase() as HttpMethod,
        path,
        summary: operation.summary ?? '',
        description: operation.description ?? '',
        tags: operation.tags ?? [],
        parameters: (operation.parameters ?? [])
          .filter(
            (parameter) => parameter.in === 'path' || parameter.in === 'query',
          )
          .map((parameter) => ({
            ...parameter,
            in: parameter.in as 'path' | 'query',
            schema: dereference(parameter.schema, schemas) as JSONSchema,
          })),
        requestBody: bodySchema
          ? (dereference(bodySchema, schemas) as JSONSchema)
          : undefined,
      })
    }
  }

  return catalog
}

export const searchOperations = (
  catalog: CatalogOperation[],
  query: string,
  limit = 10,
) => {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length > 1)

  const scored = catalog.map((operation) => {
    const primary = [operation.operationId, operation.path, ...operation.tags]
      .join(' ')
      .toLowerCase()
    const secondary = [operation.summary, operation.description]
      .join(' ')
      .toLowerCase()
    const score = terms.reduce(
      (total, term) =>
        total +
        (primary.includes(term) ? 3 : 0) +
        (secondary.includes(term) ? 1 : 0),
      0,
    )
    return { operation, score }
  })

  const matches = scored.filter(({ score }) => score > 0)
  const results = matches.length > 0 ? matches : scored

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ operation }) => ({
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
    }))
}

export const findOperation = (
  catalog: CatalogOperation[],
  operationId: string,
): CatalogOperation | undefined =>
  catalog.find((operation) => operation.operationId === operationId)

const schemaHasProperty = (schema: unknown, property: string): boolean => {
  if (!isObject(schema)) {
    return false
  }
  if (isObject(schema.properties) && property in schema.properties) {
    return true
  }
  return ['oneOf', 'anyOf', 'allOf'].some(
    (key) =>
      Array.isArray(schema[key]) &&
      (schema[key] as unknown[]).some((variant) =>
        schemaHasProperty(variant, property),
      ),
  )
}

export const prepareRequest = (
  operation: CatalogOperation,
  organizationId: string,
  input: Omit<ExecuteInput, 'operationId'>,
): PreparedRequest => {
  const pathParams: Record<string, string> = {}
  const query: Record<string, unknown> = {}

  for (const parameter of operation.parameters) {
    if (parameter.in === 'path') {
      const value = input.pathParams?.[parameter.name]
      if (!value) {
        throw new Error(`Missing required path parameter "${parameter.name}".`)
      }
      pathParams[parameter.name] = value
    } else if (parameter.name === ORGANIZATION_ID) {
      query[parameter.name] = organizationId
    } else if (input.query?.[parameter.name] !== undefined) {
      query[parameter.name] = input.query[parameter.name]
    }
  }

  let body: Record<string, unknown> | undefined
  if (operation.requestBody) {
    body = { ...(input.body ?? {}) }
    if (schemaHasProperty(operation.requestBody, ORGANIZATION_ID)) {
      body[ORGANIZATION_ID] = organizationId
    }
  }

  return {
    method: operation.method,
    path: operation.path,
    params: { path: pathParams, query },
    body,
  }
}
