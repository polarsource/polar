export type JSONSchema = { [key: string]: unknown }

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

export interface CatalogParameter extends Omit<OpenAPIParameter, 'in'> {
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
  bodyAcceptsOrganizationId: boolean
}

export interface Catalog {
  operations: CatalogOperation[]
  schemas: Record<string, JSONSchema>
}

export interface ExecuteInput {
  operationId: string
  pathParams?: Record<string, string>
  query?: Record<string, unknown>
  body?: Record<string, unknown>
}

interface PreparedRequest {
  method: HttpMethod
  path: string
  params: { path: Record<string, string>; query: Record<string, unknown> }
  body?: Record<string, unknown>
}

const ALLOWED_OPERATIONS: ReadonlySet<string> = new Set([
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
const ORGANIZATION_ID = 'organization_id'

export const isObject = (value: unknown): value is JSONSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const refName = (value: unknown): string | undefined =>
  isObject(value) && typeof value.$ref === 'string'
    ? value.$ref.split('/').pop()
    : undefined

const schemaHasProperty = (
  schema: unknown,
  property: string,
  schemas: Record<string, JSONSchema>,
  seen: ReadonlySet<string> = new Set(),
): boolean => {
  const name = refName(schema)
  if (name) {
    return (
      !seen.has(name) &&
      schemaHasProperty(
        schemas[name],
        property,
        schemas,
        new Set([...seen, name]),
      )
    )
  }
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
        schemaHasProperty(variant, property, schemas, seen),
      ),
  )
}

export const buildCatalog = (
  spec: OpenAPISpec,
  allowedOperations: ReadonlySet<string> = ALLOWED_OPERATIONS,
): Catalog => {
  const schemas = spec.components?.schemas ?? {}
  const operations: CatalogOperation[] = []

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation.operationId) {
        continue
      }
      if (!allowedOperations.has(operation.operationId)) {
        continue
      }

      const requestBody =
        operation.requestBody?.content?.['application/json']?.schema

      operations.push({
        operationId: operation.operationId,
        method: method.toUpperCase() as HttpMethod,
        path,
        summary: operation.summary ?? '',
        description: operation.description ?? '',
        tags: operation.tags ?? [],
        parameters: (operation.parameters ?? []).filter(
          (parameter): parameter is CatalogParameter =>
            parameter.in === 'path' || parameter.in === 'query',
        ),
        requestBody,
        bodyAcceptsOrganizationId: schemaHasProperty(
          requestBody,
          ORGANIZATION_ID,
          schemas,
        ),
      })
    }
  }

  return { operations, schemas }
}

export const findOperation = (
  catalog: Catalog,
  operationId: string,
): CatalogOperation | undefined =>
  catalog.operations.find((operation) => operation.operationId === operationId)

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
    if (operation.bodyAcceptsOrganizationId) {
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
