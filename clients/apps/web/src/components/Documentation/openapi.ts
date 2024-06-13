import openapiSchema from '@/openapi.json'
import { CONFIG } from '@/utils/config'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPIV3_1 } from 'openapi-types'
import { APIMethod } from './APINavigation'

const swaggerParser = new SwaggerParser()

export const fetchSchema = async (): Promise<OpenAPIV3_1.Document> => {
  let schema = openapiSchema as any
  // Fetch the schema from the server in development
  if (CONFIG.ENVIRONMENT === 'development') {
    const schemaResponse = await fetch(`${CONFIG.BASE_URL}/openapi.json`)
    schema = await schemaResponse.json()
  }
  return new Promise((resolve) =>
    swaggerParser.dereference(schema).then((parsedSchema) => {
      resolve(parsedSchema as OpenAPIV3_1.Document)
    }),
  )
}

interface EndpointMetadata {
  operation: OpenAPIV3_1.OperationObject
  method: APIMethod
  apiEndpointPath: string
}

export const resolveEndpointMetadata = (
  endpoint: string,
  schema: OpenAPIV3_1.Document,
): EndpointMetadata => {
  const parts = endpoint.split('/').filter(Boolean)

  const method = parts.pop() as APIMethod
  const apiEndpointPath =
    `/${decodeURIComponent(parts.join('/'))}` as keyof typeof schema.paths

  const apiEndpoint = schema.paths?.[apiEndpointPath]

  // Try to fallback to endpoint with trailing slash if endpoint is a root resource
  let operation: OpenAPIV3_1.OperationObject
  try {
    operation = apiEndpoint?.[method] as OpenAPIV3_1.OperationObject

    if (!operation) {
      throw new Error('Operation not found')
    }
  } catch (e) {
    // @ts-ignore
    operation = schema.paths?.[`${apiEndpointPath}/`]?.[method]
  }

  return {
    operation,
    method,
    apiEndpointPath,
  }
}

export const getRequestBodySchema = (
  operation: OpenAPIV3_1.OperationObject,
) => {
  if (
    operation &&
    operation.requestBody &&
    !('content' in operation.requestBody)
  ) {
    return undefined
  }

  const schema =
    operation &&
    operation.requestBody &&
    'content' in operation.requestBody &&
    'schema' in operation.requestBody.content['application/json'] &&
    operation.requestBody.content['application/json'].schema

  return schema
}

export const isDereferenced = <T extends object>(
  s: OpenAPIV3_1.ReferenceObject | T,
): s is T => {
  return !('$ref' in s)
}

export const getUnionSchemas = (schema: OpenAPIV3_1.SchemaObject) => {
  if (schema.oneOf) {
    return schema.oneOf
  }
  if (schema.anyOf) {
    return schema.anyOf
  }
  if (schema.allOf) {
    return schema.allOf
  }
  return null
}

const _generateScalarSchemaExample = (schema: OpenAPIV3_1.SchemaObject) => {
  if (schema.example) {
    return schema.example
  }

  if (schema.default) {
    return schema.default
  }

  if (schema.const) {
    return schema.const
  }

  if (schema.type === 'string') {
    if (schema.enum) {
      return schema.enum[0]
    }
    if (schema.format === 'date') {
      return new Date().toISOString().split('T')[0]
    }
    if (schema.format === 'date-time') {
      return new Date().toISOString()
    }
    if (schema.format === 'uuid4') {
      return '00000000-0000-0000-0000-000000000000'
    }
    return 'string'
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return schema.minimum !== undefined
      ? schema.minimum + (schema.exclusiveMinimum === true ? 1 : 0)
      : 0
  }

  if (schema.type === 'boolean') {
    return false
  }

  if (schema.type === 'null') {
    return null
  }

  if (schema.type === 'object') {
    return generateSchemaExample(schema)
  }

  if (schema.type === 'array') {
    return [generateSchemaExample(schema.items as OpenAPIV3_1.SchemaObject)]
  }
}

export const generateSchemaExample = (
  schema: OpenAPIV3_1.SchemaObject,
): Record<string, any> | string => {
  const unionSchemas = getUnionSchemas(schema)

  // TODO?: Handle more than one union schema
  if (unionSchemas) {
    return generateSchemaExample(unionSchemas.filter(isDereferenced)[0])
  }

  if (schema.properties) {
    return Object.entries(schema.properties).reduce((acc, [key, value]) => {
      return {
        ...acc,
        [key]: generateSchemaExample(value),
      }
    }, {})
  }

  return _generateScalarSchemaExample(schema)
}
