import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_VERSION = '2026-10'
const MCP_TAG = 'mcp'
const META_TAGS = new Set(['public', 'mcp', 'cli'])
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
const SCHEMA_REF_PREFIX = '#/components/schemas/'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(
  root,
  `../../../docs/openapi/${API_VERSION}.openapi.json`,
)
const outputPath = resolve(root, 'src/generated/spec.json')

type JsonObject = Record<string, unknown>

const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
  paths: Record<string, JsonObject>
  components: { schemas: Record<string, unknown> }
}

const stripExamples = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripExamples)
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'example' && key !== 'examples')
      .map(([key, child]) => [key, stripExamples(child)]),
  )
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

const paths: Record<string, Record<string, unknown>> = {}
const tagCounts = new Map<string, number>()

for (const [path, pathItem] of Object.entries(source.paths)) {
  for (const method of HTTP_METHODS) {
    const operation = pathItem[method] as JsonObject | undefined
    const tags = (operation?.tags as string[] | undefined) ?? []
    if (!operation || !tags.includes(MCP_TAG)) {
      continue
    }

    const resourceTags = tags.filter((tag) => !META_TAGS.has(tag))
    for (const tag of resourceTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }

    const responses = Object.fromEntries(
      Object.entries((operation.responses as JsonObject) ?? {}).filter(
        ([status]) => status.startsWith('2'),
      ),
    )

    paths[path] ??= {}
    paths[path][method] = stripExamples({
      operationId: operation.operationId,
      summary: operation.summary,
      description: operation.description,
      tags: resourceTags,
      parameters: operation.parameters,
      requestBody: operation.requestBody,
      responses,
    })
  }
}

const schemaNames = new Set<string>()
const pending = new Set<string>()
collectSchemaRefs(paths, pending)
while (pending.size > 0) {
  const [name] = pending
  pending.delete(name)
  if (schemaNames.has(name)) {
    continue
  }
  schemaNames.add(name)
  collectSchemaRefs(source.components.schemas[name], pending)
}

const schemas = Object.fromEntries(
  [...schemaNames]
    .sort()
    .map((name) => [name, stripExamples(source.components.schemas[name])]),
)

const tags = [...tagCounts.entries()]
  .sort(([, a], [, b]) => b - a)
  .map(([tag]) => tag)

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(
  outputPath,
  JSON.stringify({ apiVersion: API_VERSION, tags, paths, schemas }),
)

const operationCount = Object.values(paths).reduce(
  (count, methods) => count + Object.keys(methods).length,
  0,
)
console.log(
  `Wrote ${operationCount} operations and ${schemaNames.size} schemas to ${outputPath} (${Math.round(readFileSync(outputPath).length / 1024)} KB)`,
)
