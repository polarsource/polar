import { OpenAPIV3_1 } from 'openapi-types'

export const isSchemaObject = (
  s: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject,
): s is OpenAPIV3_1.SchemaObject => {
  return !('$ref' in s)
}

export const getUnionSchemas = (schema: OpenAPIV3_1.SchemaObject) => {
  if (schema.oneOf) {
    return schema.oneOf
  }
  if (schema.anyOf) {
    return schema.anyOf
  }
  return null
}
