import {
  Catalog,
  CatalogOperation,
  CatalogParameter,
  isObject,
  JSONSchema,
  refName,
} from './apiCatalog'

const STRIPPED_SCHEMA_KEYS = new Set(['title', 'examples', 'example'])
const UNION_KEYS = new Set(['oneOf', 'anyOf'])
const MAX_DESCRIPTION_LENGTH = 300

const OMITTED_SCHEMAS: ReadonlySet<string> = new Set([
  'BenefitDiscordCreate',
  'BenefitDiscordUpdate',
  'BenefitGitHubRepositoryCreate',
  'BenefitGitHubRepositoryUpdate',
  'BenefitDownloadablesCreate',
  'BenefitDownloadablesUpdate',
  'BenefitSlackSharedChannelCreate',
  'BenefitSlackSharedChannelUpdate',
])

const OMITTED_PROPERTIES: ReadonlySet<string> = new Set([
  'organization_id',
  'medias',
  'attached_custom_fields',
])

export const shortenDescription = (description: string): string => {
  const [paragraph] = description.trim().split(/\n\s*\n/)
  if (paragraph.length <= MAX_DESCRIPTION_LENGTH) {
    return paragraph
  }
  const cut = paragraph.slice(0, MAX_DESCRIPTION_LENGTH)
  const sentenceEnd = cut.lastIndexOf('. ')
  return sentenceEnd > 0 ? cut.slice(0, sentenceEnd + 1) : `${cut}…`
}

const isOmitted = (value: unknown): boolean =>
  OMITTED_SCHEMAS.has(refName(value) ?? '')

const trim = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(trim)
  }
  if (!isObject(value)) {
    return value
  }

  const result: JSONSchema = {}
  for (const [key, child] of Object.entries(value)) {
    if (STRIPPED_SCHEMA_KEYS.has(key)) {
      continue
    }
    if (key === 'description' && typeof child === 'string') {
      result.description = shortenDescription(child)
    } else if (key === 'properties' && isObject(child)) {
      result.properties = Object.fromEntries(
        Object.entries(child)
          .filter(
            ([name, property]) =>
              !OMITTED_PROPERTIES.has(name) &&
              !(isObject(property) && property.deprecated === true),
          )
          .map(([name, property]) => [name, trim(property)]),
      )
    } else if (key === 'required' && Array.isArray(child)) {
      result.required = child.filter((name) => !OMITTED_PROPERTIES.has(name))
    } else if (key === 'discriminator' && isObject(child)) {
      result.discriminator = { propertyName: child.propertyName }
    } else if (UNION_KEYS.has(key) && Array.isArray(child)) {
      result[key] = child.filter((variant) => !isOmitted(variant)).map(trim)
    } else {
      result[key] = trim(child)
    }
  }
  return result
}

/**
 * Resolves `$ref`s against the component schemas. A schema referenced once is
 * inlined; a schema referenced more than once (or recursively) is emitted once
 * in `$defs` and referenced from there.
 */
export const compactSchemas = (
  roots: unknown[],
  schemas: Record<string, JSONSchema>,
): { roots: unknown[]; $defs: Record<string, unknown> } => {
  const trimmed = new Map<string, unknown>()
  const resolve = (name: string) => {
    if (!trimmed.has(name)) {
      trimmed.set(name, trim(schemas[name]))
    }
    return trimmed.get(name)
  }

  const counts = new Map<string, number>()
  const count = (value: unknown): void => {
    const name = refName(value)
    if (name !== undefined) {
      const occurrences = (counts.get(name) ?? 0) + 1
      counts.set(name, occurrences)
      if (occurrences === 1 && schemas[name]) {
        count(resolve(name))
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach(count)
    } else if (isObject(value)) {
      Object.values(value).forEach(count)
    }
  }

  const trimmedRoots = roots.map(trim)
  trimmedRoots.forEach(count)

  const hoisted = [...counts]
    .filter(([name, occurrences]) => occurrences > 1 && schemas[name])
    .map(([name]) => name)
  const hoistedNames = new Set(hoisted)

  const inline = (value: unknown): unknown => {
    const name = refName(value)
    if (name !== undefined) {
      if (!schemas[name]) {
        return { type: 'object', description: `A ${name} object.` }
      }
      return hoistedNames.has(name)
        ? { $ref: `#/$defs/${name}` }
        : inline(resolve(name))
    }
    if (Array.isArray(value)) {
      return value.map(inline)
    }
    if (isObject(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, inline(child)]),
      )
    }
    return value
  }

  return {
    roots: trimmedRoots.map(inline),
    $defs: Object.fromEntries(
      hoisted.map((name) => [name, inline(resolve(name))]),
    ),
  }
}

const parametersSchema = (
  parameters: CatalogParameter[],
  schemas: unknown[],
): JSONSchema => ({
  type: 'object',
  properties: Object.fromEntries(
    parameters.map((parameter, index) => [
      parameter.name,
      parameter.description
        ? {
            ...(schemas[index] as JSONSchema),
            description: shortenDescription(parameter.description),
          }
        : schemas[index],
    ]),
  ),
  required: parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name),
})

export const buildToolInputSchema = (
  catalog: Catalog,
  operation: CatalogOperation,
): JSONSchema => {
  const pathParameters = operation.parameters.filter(
    (parameter) => parameter.in === 'path',
  )
  const queryParameters = operation.parameters.filter(
    (parameter) =>
      parameter.in === 'query' && !OMITTED_PROPERTIES.has(parameter.name),
  )
  const { roots, $defs } = compactSchemas(
    [
      ...[...pathParameters, ...queryParameters].map(({ schema }) => schema),
      operation.requestBody,
    ],
    catalog.schemas,
  )

  const properties: JSONSchema = {}
  const required: string[] = []
  if (pathParameters.length > 0) {
    properties.path = parametersSchema(pathParameters, roots)
    required.push('path')
  }
  if (queryParameters.length > 0) {
    properties.query = parametersSchema(
      queryParameters,
      roots.slice(pathParameters.length),
    )
  }
  if (operation.requestBody) {
    properties.body = roots[roots.length - 1]
    required.push('body')
  }

  return {
    type: 'object',
    properties,
    required,
    ...(Object.keys($defs).length > 0 ? { $defs } : {}),
  }
}
