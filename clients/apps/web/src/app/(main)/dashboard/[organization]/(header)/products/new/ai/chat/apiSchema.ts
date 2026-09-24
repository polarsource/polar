import {
  Catalog,
  CatalogOperation,
  isObject,
  JSONSchema,
  refName,
} from './apiCatalog'

const STRIPPED_SCHEMA_KEYS = new Set(['title', 'examples', 'example'])
const UNION_KEYS = new Set(['oneOf', 'anyOf'])
const MAX_DESCRIPTION_LENGTH = 300
const VARIANT_SUMMARY_THRESHOLD = 16_000

export const OMITTED_SCHEMAS: ReadonlySet<string> = new Set([
  'BenefitDiscordCreate',
  'BenefitDiscordUpdate',
  'BenefitGitHubRepositoryCreate',
  'BenefitGitHubRepositoryUpdate',
  'BenefitDownloadablesCreate',
  'BenefitDownloadablesUpdate',
  'BenefitSlackSharedChannelCreate',
  'BenefitSlackSharedChannelUpdate',
])

export const OMITTED_PROPERTIES: ReadonlySet<string> = new Set([
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

const getBodyVariants = (
  body: unknown,
  schemas: Record<string, JSONSchema>,
): Map<string, unknown> | undefined => {
  const name = refName(body)
  const schema = name ? schemas[name] : body
  if (!isObject(schema)) {
    return undefined
  }

  const union = schema.oneOf ?? schema.anyOf
  if (!Array.isArray(union) || union.length < 2) {
    return undefined
  }

  const discriminator = isObject(schema.discriminator)
    ? schema.discriminator
    : undefined
  const mapping = isObject(discriminator?.mapping)
    ? (discriminator.mapping as Record<string, string>)
    : {}
  const keyBySchemaName = new Map(
    Object.entries(mapping).map(([key, ref]) => [ref.split('/').pop(), key]),
  )

  return new Map(
    union
      .filter((variant) => !isOmitted(variant))
      .map((variant, index) => {
        const variantName = refName(variant)
        const key =
          (variantName && keyBySchemaName.get(variantName)) ??
          variantName ??
          `variant_${index}`
        return [key, variant]
      }),
  )
}

export const describeOperation = (
  catalog: Catalog,
  operation: CatalogOperation,
  variant?: string,
) => {
  const variants = getBodyVariants(operation.requestBody, catalog.schemas)
  if (variant !== undefined && !variants?.has(variant)) {
    return {
      operationId: operation.operationId,
      error: variants
        ? `Unknown variant. Valid variants: ${[...variants.keys()].join(', ')}.`
        : 'This operation has no request body variants.',
    }
  }

  const describe = (body: unknown) => {
    const { roots, $defs } = compactSchemas(
      [...operation.parameters.map(({ schema }) => schema), body],
      catalog.schemas,
    )
    return {
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
      description: shortenDescription(operation.description),
      parameters: operation.parameters.map((parameter, index) => ({
        name: parameter.name,
        in: parameter.in,
        required: parameter.required ?? false,
        description: parameter.description
          ? shortenDescription(parameter.description)
          : undefined,
        schema: roots[index],
      })),
      requestBody: roots[operation.parameters.length],
      ...(Object.keys($defs).length > 0 ? { $defs } : {}),
    }
  }

  if (variant !== undefined) {
    return { ...describe(variants?.get(variant)), variant }
  }

  const full = describe(operation.requestBody)
  if (!variants || JSON.stringify(full).length <= VARIANT_SUMMARY_THRESHOLD) {
    return full
  }

  return {
    ...describe(undefined),
    requestBody: undefined,
    variants: [...variants.keys()],
    note: 'The request body has several variants. Describe this operation again with one of these variants to get its schema.',
  }
}
