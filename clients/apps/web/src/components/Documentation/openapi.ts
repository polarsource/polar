import openapiSchema from '@/openapi.json'
import { CONFIG } from '@/utils/config'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPIV3_1 } from 'openapi-types'

const swaggerParser = new SwaggerParser()

enum HttpMethods {
  GET = 'get',
  PUT = 'put',
  POST = 'post',
  DELETE = 'delete',
  OPTIONS = 'options',
  HEAD = 'head',
  PATCH = 'patch',
  TRACE = 'trace',
}

export const fetchSchema = async (): Promise<OpenAPIV3_1.Document> => {
  let schema = openapiSchema as any
  // Fetch the schema from the server in development
  if (CONFIG.ENVIRONMENT === 'development') {
    const schemaResponse = await fetch(`${CONFIG.BASE_URL}/openapi.json`, {
      cache: 'no-store',
    })
    schema = await schemaResponse.json()
  }
  return new Promise((resolve) =>
    swaggerParser.dereference(schema).then((parsedSchema) => {
      resolve(parsedSchema as OpenAPIV3_1.Document)
    }),
  )
}

const isMethod = (method: string): method is HttpMethods =>
  Object.values(HttpMethods).includes(method as HttpMethods)

export class EndpointError extends Error {
  constructor(endpoint: string[]) {
    super(`Endpoint not found or invalid: ${endpoint}`)
  }
}

export interface EndpointMetadata {
  operation: OpenAPIV3_1.OperationObject
  method: HttpMethods
  apiEndpointPath: string
}

export const resolveEndpointMetadata = (
  endpoint: string[],
  schema: OpenAPIV3_1.Document,
): EndpointMetadata => {
  const parts = endpoint.slice(0, -1)
  const method = endpoint[endpoint.length - 1]

  if (!isMethod(method)) {
    throw new EndpointError(endpoint)
  }

  let apiEndpointPath = `/${decodeURIComponent(parts.join('/'))}`

  // Try to fallback to endpoint with trailing slash if endpoint is a root resource
  let apiEndpoint = schema.paths?.[apiEndpointPath]
  if (!apiEndpoint) {
    apiEndpointPath = `${apiEndpointPath}/`
    apiEndpoint = schema.paths?.[apiEndpointPath]
  }

  if (!apiEndpoint) {
    throw new EndpointError(endpoint)
  }

  const operation = apiEndpoint?.[method]
  if (!operation) {
    throw new EndpointError(endpoint)
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
    operation.requestBody.content['application/json'] &&
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

const generateScalarSchemaExample = (schema: OpenAPIV3_1.SchemaObject) => {
  if (schema.example) {
    return schema.example
  }

  if (schema.const) {
    return schema.const
  }

  if (schema.enum) {
    return schema.enum[0]
  }

  if (schema.type === 'string') {
    if (schema.format === 'date' || schema.format === 'date-time') {
      const todayAtMidnight = new Date()
      todayAtMidnight.setHours(0, 0, 0, 0) // Avoids hydration issues
      if (schema.format === 'date') {
        return todayAtMidnight.toISOString().split('T')[0]
      } else {
        return todayAtMidnight.toISOString()
      }
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
    if (schema.additionalProperties) {
      return {}
    }
    return generateSchemaExample(schema)
  }

  if (schema.type === 'array') {
    return [generateSchemaExample(schema.items as OpenAPIV3_1.SchemaObject)]
  }

  // Completely empty schema information
  if (typeof schema === 'object' && Object.keys(schema).length === 0) {
    return {}
  }

  throw new Error(
    `Could not generate example for schema: ${JSON.stringify(schema)}`,
  )
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

  return generateScalarSchemaExample(schema)
}

const getParametersExample = (
  endpoint: OpenAPIV3_1.OperationObject,
  include: ('path' | 'query')[],
) => {
  if (!endpoint.parameters) {
    return undefined
  }
  return endpoint.parameters.reduce(
    (acc, parameter) => {
      if (
        isDereferenced(parameter) &&
        parameter.required &&
        include.some((i) => i === parameter.in) &&
        parameter.schema &&
        isDereferenced<OpenAPIV3_1.SchemaObject>(parameter.schema)
      ) {
        return {
          ...acc,
          [parameter.name]: generateSchemaExample(parameter.schema),
        }
      }
      return acc
    },
    {} as Record<string, any>,
  )
}

export const buildCurlCommand = (
  method: string = 'GET',
  url: string,
  endpoint: OpenAPIV3_1.OperationObject,
): string => {
  const parametersExample = getParametersExample(endpoint, ['query'])
  const queryParametersString = new URLSearchParams(
    parametersExample,
  ).toString()

  const bodySchema = getRequestBodySchema(endpoint)
  const bodyExample = bodySchema ? generateSchemaExample(bodySchema) : undefined
  const bodyString = bodyExample
    ? `-d '${JSON.stringify(bodyExample, null, 2)}'`
    : ''

  return `curl -X ${method.toUpperCase()} \\
${url}${queryParametersString ? '?' + queryParametersString : ''} \\
-H "Content-type: application/json" \\
-H "Accept: application/json" \\
-H "Authorization: Bearer <token>" \\
${bodyString}`
}

const snakeToCamel = (str: string) =>
  str
    .toLowerCase()
    .replace(/([-_][a-z])/g, (group: string) =>
      group.toUpperCase().replace('-', '').replace('_', ''),
    )

const objectToString = (obj: any, indent: number = 0): string => {
  const indentBase = '  '
  let result = '{\n'
  const entries = Object.entries(obj)

  entries.forEach(([key, value], index) => {
    const isLast = index === entries.length - 1
    const lineIndent = indentBase.repeat(indent + 1)
    const nextIndent = indent + 1
    let valueString

    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      valueString = objectToString(value, nextIndent)
    } else if (Array.isArray(value)) {
      valueString = `[${value
        .map((v) => {
          if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
            return objectToString(v, nextIndent)
          } else if (typeof v === 'string') {
            return `'${v}'`
          } else {
            return v
          }
        })
        .join(', ')}]`
    } else if (typeof value === 'string') {
      valueString = `'${value}'`
    } else {
      valueString = value
    }

    result += `${lineIndent}${key}: ${valueString}${isLast ? '' : ','}\n`
  })

  result += `${indentBase.repeat(indent)}}`
  return result
}

const convertToCamelCase = (obj: Record<string, any>): Record<string, any> =>
  Object.keys(obj).reduce(
    (acc, key) => {
      const newKey = snakeToCamel(key)
      return {
        ...acc,
        [newKey]: obj[key],
      }
    },
    {} as Record<string, any>,
  )

export const buildNodeJSCommand = (
  endpoint: OpenAPIV3_1.OperationObject,
): string => {
  const RESERVED_KEYWORDS = ['import', 'export']
  let [namespace, endpointName] = endpoint.operationId?.split(':') ?? ['', '']
  endpointName = snakeToCamel(endpointName)
  if (RESERVED_KEYWORDS.includes(endpointName)) {
    endpointName = `_${endpointName}`
  }

  const parametersExamples = getParametersExample(endpoint, ['path', 'query'])
  const bodySchema = getRequestBodySchema(endpoint)
  const bodyExample = bodySchema ? generateSchemaExample(bodySchema) : undefined

  const requestParameters = {
    ...(parametersExamples ? convertToCamelCase(parametersExamples) : {}),
    ...(bodySchema && isDereferenced(bodySchema) && bodyExample
      ? {
          body: bodyExample,
        }
      : {}),
  }

  return `import { PolarAPI, Configuration } from '@polar-sh/sdk';

const polar = new PolarAPI(
    new Configuration({
        headers: {
            'Authorization': \`Bearer \${process.env.POLAR_ACCESS_TOKEN}\`
        }
    })
);

polar.${namespace}.${endpointName}(${objectToString(requestParameters)})
  .then(console.log)
  .catch(console.error);
`
}

enum APITags {
  documented = 'documented',
  featured = 'featured',
}

export interface APISection {
  name: string
  endpoints: {
    id: string
    name: string
    path: string
    method: HttpMethods
    documented: boolean
    featured: boolean
  }[]
}

export const isFeaturedEndpoint = (
  endpoint: OpenAPIV3_1.OperationObject,
): boolean => {
  if (!endpoint.tags) {
    return false
  }
  return endpoint.tags.includes(APITags.featured)
}

export const isNotFeaturedEndpoint = (
  endpoint: OpenAPIV3_1.OperationObject,
): boolean => !isFeaturedEndpoint(endpoint)

export const getAPISections = (
  schema: OpenAPIV3_1.Document,
  endpointFilter?: (endpoint: OpenAPIV3_1.OperationObject) => boolean,
): APISection[] => {
  if (!schema.paths) {
    return []
  }

  const sectionsMap: Record<string, APISection> = {}

  // Iterate over all paths
  for (const [path, endpoints] of Object.entries(schema.paths)) {
    // No endpoints for this path
    if (!endpoints) {
      continue
    }
    // Iterate over all methods in this path
    for (const method of Object.values(HttpMethods)) {
      const endpoint = endpoints[method]
      // No endpoint for this method
      if (!endpoint) {
        continue
      }
      // Skip if doesn't pass the filter
      if (endpointFilter && !endpointFilter(endpoint)) {
        continue
      }

      const tags = endpoint.tags
      // No tag, skip this endpoint
      if (!tags || tags.length === 0) {
        console.warn(`Endpoint ${path} ${method} has no tags`)
        continue
      }

      // No operationId, skip this endpoint
      if (!endpoint.operationId) {
        console.warn(`Endpoint ${path} ${method} has no operationId`)
        continue
      }

      // Skip if not marked as documented
      if (!tags.includes(APITags.documented)) {
        continue
      }

      const groupTag = tags[0]
      // Make sure the first tag is a valid group tag
      if (Object.values(APITags).includes(groupTag as APITags)) {
        console.warn(`Endpoint ${path} ${method} doesn't have a group tag`)
        continue
      }
      const sectionEndpoint = {
        id: endpoint.operationId,
        name: endpoint.summary || endpoint.operationId,
        path,
        method,
        documented: tags.includes(APITags.documented),
        featured: tags.includes(APITags.featured),
      }
      const section = sectionsMap[groupTag] || {
        name: groupTag
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (match) => match.toUpperCase()),
        endpoints: [],
      }
      section.endpoints.push(sectionEndpoint)
      sectionsMap[groupTag] = section
    }
  }

  return Object.values(sectionsMap)
    .filter((section) => section.endpoints.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'en-US'))
}
