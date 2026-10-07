import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_VERSION = '2026-10'
const MCP_TAG = 'mcp'
const META_TAGS = new Set(['public', 'mcp', 'cli'])
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
const SCHEMA_REF_PREFIX = '#/components/schemas/'
const TOOL_SCHEMA_REF_PREFIX = '#/$defs/'
const BODY_ARGUMENT = 'body'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(
  root,
  `../../../docs/openapi/${API_VERSION}.openapi.json`,
)
const outputDirectory = resolve(root, 'src/generated')

type JsonObject = Record<string, unknown>

interface Parameter {
  name: string
  in: 'path' | 'query'
  required?: boolean
  description?: string
  schema: JsonObject
}

interface Operation {
  operationId: string
  summary: string
  description: string
  tags: string[]
  parameters?: Parameter[]
  requestBody?: {
    required?: boolean
    content: Record<string, { schema: JsonObject }>
  }
  responses: JsonObject
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
  paths: Record<string, Partial<Record<string, Operation>>>
  components: { schemas: Record<string, unknown> }
}

const stripExamples = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(stripExamples) as T
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'example' && key !== 'examples')
      .map(([key, child]) => [key, stripExamples(child)]),
  ) as T
}

const rewriteSchemaRefs = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(rewriteSchemaRefs) as T
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === '$ref' && typeof child === 'string'
        ? child.replace(SCHEMA_REF_PREFIX, TOOL_SCHEMA_REF_PREFIX)
        : rewriteSchemaRefs(child),
    ]),
  ) as T
}

const collectSchemaRefs = (value: unknown, refs: Set<string>): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaRefs(item, refs))
    return
  }
  if (value === null || typeof value !== 'object') {
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      key === '$ref' &&
      typeof child === 'string' &&
      child.startsWith(SCHEMA_REF_PREFIX)
    ) {
      refs.add(child.slice(SCHEMA_REF_PREFIX.length))
    } else {
      collectSchemaRefs(child, refs)
    }
  }
}

const referencedSchemas = (value: unknown) => {
  const names = new Set<string>()
  const pending = new Set<string>()
  collectSchemaRefs(value, pending)
  while (pending.size > 0) {
    const [name] = pending
    pending.delete(name)
    if (names.has(name)) {
      continue
    }
    names.add(name)
    collectSchemaRefs(source.components.schemas[name], pending)
  }
  return Object.fromEntries(
    [...names]
      .sort()
      .map((name) => [name, stripExamples(source.components.schemas[name])]),
  )
}

const operations = Object.entries(source.paths).flatMap(([path, pathItem]) =>
  HTTP_METHODS.flatMap((method) => {
    const operation = pathItem[method]
    if (!operation?.tags.includes(MCP_TAG)) {
      return []
    }
    const responses = Object.fromEntries(
      Object.entries(operation.responses).filter(([status]) =>
        status.startsWith('2'),
      ),
    )
    return [
      {
        path,
        method,
        operation: stripExamples({
          operationId: operation.operationId,
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags.filter((tag) => !META_TAGS.has(tag)),
          parameters: operation.parameters,
          requestBody: operation.requestBody,
          responses,
        }),
      },
    ]
  }),
)

const buildSpec = () => {
  const paths: Record<string, Record<string, Operation>> = {}
  const tagCounts = new Map<string, number>()
  for (const { path, method, operation } of operations) {
    paths[path] ??= {}
    paths[path][method] = operation
    for (const tag of operation.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const tags = [...tagCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag)
  return {
    apiVersion: API_VERSION,
    tags,
    paths,
    schemas: referencedSchemas(paths),
  }
}

const buildTools = () =>
  operations.map(({ path, method, operation }) => {
    const parameters = operation.parameters ?? []
    if (parameters.some(({ name }) => name === BODY_ARGUMENT)) {
      throw new Error(
        `${operation.operationId} has a parameter named "${BODY_ARGUMENT}"`,
      )
    }

    const properties: Record<string, JsonObject> = Object.fromEntries(
      parameters.map(({ name, schema, description }) => [
        name,
        { ...schema, description: description ?? schema.description },
      ]),
    )
    const required = parameters
      .filter((parameter) => parameter.required)
      .map(({ name }) => name)

    const bodySchema =
      operation.requestBody?.content['application/json']?.schema
    if (bodySchema) {
      properties[BODY_ARGUMENT] = bodySchema
      if (operation.requestBody?.required) {
        required.push(BODY_ARGUMENT)
      }
    }

    return {
      name: operation.operationId.replaceAll(':', '_'),
      title: operation.summary,
      description: operation.description,
      method: method.toUpperCase(),
      path,
      queryParameters: parameters
        .filter((parameter) => parameter.in === 'query')
        .map(({ name }) => name),
      inputSchema: rewriteSchemaRefs({
        type: 'object',
        properties,
        required,
        $defs: referencedSchemas(properties),
      }),
    }
  })

const write = (fileName: string, value: unknown) => {
  const path = resolve(outputDirectory, fileName)
  writeFileSync(path, JSON.stringify(value))
  return `${fileName} (${Math.round(readFileSync(path).length / 1024)} KB)`
}

mkdirSync(outputDirectory, { recursive: true })
console.log(
  `Generated ${operations.length} operations: ${write('spec.json', buildSpec())}, ${write('tools.json', buildTools())}`,
)
