import { OpenAPIV3_1 } from 'openapi-types'

export const resolveValue = (property: OpenAPIV3_1.SchemaObject) => {
  if ('anyOf' in property) return property.anyOf?.map(resolveValue).join(' | ')

  switch (property.type) {
    case 'array':
      return [resolveValue(property.items)]

    case 'object':
      return Object.entries(property.properties || {}).reduce(
        (acc, [key, value]) => {
          return {
            ...acc,
            [key]: resolveValue(value),
          }
        },
        {},
      )
    default:
      return property.example ?? property.format
        ? `${property.type} (${property.format})`
        : property.type
  }
}
