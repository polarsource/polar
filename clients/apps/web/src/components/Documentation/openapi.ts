import openapiSchema from '@/openapi.json'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPIV3_1 } from 'openapi-types'

const swaggerParser = new SwaggerParser()

export enum HttpMethod {
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
  return new Promise((resolve) =>
    swaggerParser.dereference(openapiSchema as any).then((parsedSchema) => {
      resolve(parsedSchema as OpenAPIV3_1.Document)
    }),
  )
}

const isMethod = (method: string): method is HttpMethod =>
  Object.values(HttpMethod).includes(method as HttpMethod)

export class EndpointError extends Error {
  constructor(endpoint: string[]) {
    super(`Endpoint not found or invalid: ${endpoint}`)
  }
}

export interface EndpointMetadata {
  operation: OpenAPIV3_1.OperationObject
  method: HttpMethod
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

export const isDereferenced = <T extends object>(
  s: OpenAPIV3_1.ReferenceObject | T,
): s is T => {
  return !('$ref' in s)
}

export enum MediaType {
  JSON = 'application/json',
  FORM = 'application/x-www-form-urlencoded',
}

export const getRequestBodySchema = (
  operation: OpenAPIV3_1.OperationObject,
): [OpenAPIV3_1.SchemaObject, MediaType] | undefined => {
  const requestBody = operation.requestBody
  if (!requestBody || !isDereferenced(requestBody)) {
    return undefined
  }
  const content = requestBody.content
  for (const mediaType of Object.values(MediaType)) {
    const mediaTypeObject = content[mediaType]
    if (
      mediaTypeObject &&
      isDereferenced(mediaTypeObject) &&
      mediaTypeObject.schema &&
      isDereferenced(mediaTypeObject.schema)
    ) {
      return [mediaTypeObject.schema, mediaType]
    }
  }
  return undefined
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

export const isArraySchema = (
  s: OpenAPIV3_1.SchemaObject,
): s is OpenAPIV3_1.ArraySchemaObject => s.type === 'array'

export const isScalarArraySchema = (
  schema: OpenAPIV3_1.ArraySchemaObject,
): boolean => {
  return isDereferenced(schema.items) && schema.items.type !== 'object'
}

export const resolveSchemaMinMax = (
  schema: OpenAPIV3_1.SchemaObject,
): [number | undefined, number | undefined] => {
  let minimum: number | undefined = undefined
  let maximum: number | undefined = undefined
  if (schema.minimum !== undefined) {
    if (schema.exclusiveMinimum === true) {
      minimum = schema.minimum + 1
    }
  }
  if (schema.maximum !== undefined) {
    if (schema.exclusiveMaximum === true) {
      maximum = schema.maximum - 1
    }
  }
  if (
    schema.exclusiveMinimum !== undefined &&
    Number.isInteger(schema.exclusiveMinimum)
  ) {
    minimum = (schema.exclusiveMinimum as number) + 1
  }
  if (
    schema.exclusiveMaximum !== undefined &&
    Number.isInteger(schema.exclusiveMaximum)
  ) {
    maximum = (schema.exclusiveMaximum as number) - 1
  }
  return [minimum, maximum]
}

const generateScalarSchemaExample = (
  schema: OpenAPIV3_1.SchemaObject,
  defaults: Record<string, any> | string,
  requiredOnly: boolean = false,
  depth: number = 0,
) => {
  if (schema.type === 'object') {
    if (schema.additionalProperties) {
      return {}
    }
    if (depth > 1) return {}
    return generateSchemaExample(schema, defaults, requiredOnly, depth + 1)
  }

  if (schema.type === 'array') {
    return [
      generateSchemaExample(
        schema.items as OpenAPIV3_1.SchemaObject,
        defaults,
        requiredOnly,
      ),
    ]
  }

  if (typeof defaults === 'string') {
    return parseDefaultParameterValue(schema, defaults)
  }

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
    const [minimum] = resolveSchemaMinMax(schema)
    return minimum !== undefined ? minimum : 0
  }

  if (schema.type === 'boolean') {
    return false
  }

  if (schema.type === 'null') {
    return null
  }

  // Completely empty schema information
  if (typeof schema === 'object' && Object.keys(schema).length === 0) {
    return {}
  }

  throw new Error(
    `Could not generate example for schema: ${JSON.stringify(schema)}`,
  )
}

const parseDefaultParameterValue = (
  schema: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject | undefined,
  value: string,
) => {
  if (!schema || !isDereferenced(schema)) {
    return value
  }

  if (schema.type === 'number') {
    return Number.parseFloat(value)
  }
  if (schema.type === 'integer') {
    return Number.parseInt(value)
  }
  if (schema.type === 'boolean') {
    return value === 'true'
  }

  // TODO: Handle more types

  return value
}

export const generateSchemaExample = (
  schema: OpenAPIV3_1.SchemaObject,
  defaults: Record<string, any> | string = {},
  requiredOnly: boolean = false,
  depth: number = 0,
): Record<string, any> | string => {
  const unionSchemas = getUnionSchemas(schema)

  // TODO?: Handle more than one union schema
  if (unionSchemas) {
    return generateSchemaExample(
      unionSchemas.filter(isDereferenced)[0],
      defaults,
      requiredOnly,
    )
  }

  if (schema.properties) {
    return Object.entries(schema.properties).reduce((acc, [key, value]) => {
      if (
        requiredOnly &&
        !schema.required?.includes(key) &&
        (!defaults || !(typeof defaults === 'object') || !defaults[key])
      ) {
        return acc
      }
      const childDefaults =
        defaults && typeof defaults === 'object' ? defaults[key] : {}
      return {
        ...acc,
        [key]: generateSchemaExample(value, childDefaults, requiredOnly),
      }
    }, {})
  }

  return generateScalarSchemaExample(schema, defaults, requiredOnly, depth + 1)
}

const getParameters = (
  endpoint: OpenAPIV3_1.OperationObject,
  include: ('path' | 'query')[],
): OpenAPIV3_1.ParameterObject[] => {
  if (!endpoint.parameters) {
    return []
  }
  return endpoint.parameters.filter(
    (parameter) =>
      isDereferenced(parameter) && include.some((i) => i === parameter.in),
  ) as OpenAPIV3_1.ParameterObject[]
}

const getParametersExample = (
  endpoint: OpenAPIV3_1.OperationObject,
  include: ('path' | 'query')[],
  defaults: Record<string, any> = {},
) => {
  return getParameters(endpoint, include).reduce(
    (acc, parameter) => {
      if (
        parameter.schema &&
        isDereferenced<OpenAPIV3_1.SchemaObject>(parameter.schema) &&
        (parameter.required || defaults[parameter.name] !== undefined)
      ) {
        return {
          ...acc,
          [parameter.name]: generateSchemaExample(
            parameter.schema,
            defaults[parameter.name],
          ),
        }
      }
      return acc
    },
    {} as Record<string, any>,
  )
}

export const PATH_PARAMETER_PREFIX = 'p_'
export const QUERY_PARAMETER_PREFIX = 'q_'
export const BODY_PARAMETER_PREFIX = 'b_'
const parameterPattern = new RegExp(
  `(${PATH_PARAMETER_PREFIX}|${QUERY_PARAMETER_PREFIX}|${BODY_PARAMETER_PREFIX})(.*)`,
)

export const getParameterName = (
  name: string,
  location: 'path' | 'query' | 'body',
): string => {
  switch (location) {
    case 'path':
      return `${PATH_PARAMETER_PREFIX}${name}`
    case 'query':
      return `${QUERY_PARAMETER_PREFIX}${name}`
    case 'body':
      return `${BODY_PARAMETER_PREFIX}${name}`
  }
}

const getLocationFromPrefix = (prefix: string): 'path' | 'query' | 'body' => {
  switch (prefix) {
    case PATH_PARAMETER_PREFIX:
      return 'path'
    case QUERY_PARAMETER_PREFIX:
      return 'query'
    case BODY_PARAMETER_PREFIX:
      return 'body'
    default:
      throw new Error(`Invalid parameter prefix: ${prefix}`)
  }
}

interface ICommandBuilder {
  buildCommand(
    method: string | HttpMethod,
    url: string,
    operation: OpenAPIV3_1.OperationObject,
    params: Record<string, string> | undefined,
  ): string
}

abstract class ManualCommandBuilder implements ICommandBuilder {
  public abstract buildCommand(
    method: string | HttpMethod,
    url: string,
    operation: OpenAPIV3_1.OperationObject,
    params: Record<string, string> | undefined,
  ): string

  protected getPathParameters(
    operation: OpenAPIV3_1.OperationObject,
    params: Record<string, string>,
  ): Record<string, string> {
    const explodedParams = this.explodeParams(params, ['path'])
    return getParametersExample(operation, ['path'], explodedParams)
  }

  protected getQueryParameters(
    operation: OpenAPIV3_1.OperationObject,
    params: Record<string, string>,
  ): Record<string, string> {
    const explodedParams = this.explodeParams(params, ['query'])
    return getParametersExample(operation, ['query'], explodedParams)
  }

  protected getBody(
    operation: OpenAPIV3_1.OperationObject,
    params: Record<string, string>,
  ): Record<string, any> | undefined {
    const bodySchema = getRequestBodySchema(operation)
    if (!bodySchema) {
      return undefined
    }
    const explodedParams = this.explodeParams(params, ['body'])
    return generateSchemaExample(bodySchema[0], explodedParams, true) as Record<
      string,
      any
    >
  }

  protected getMediaType(
    operation: OpenAPIV3_1.OperationObject,
  ): MediaType | undefined {
    const bodySchema = getRequestBodySchema(operation)
    return bodySchema ? bodySchema[1] : undefined
  }

  private explodeParams(
    params: Record<string, string>,
    include: ('path' | 'query' | 'body')[],
  ): Record<string, any> {
    return Object.entries(params).reduce(
      (acc, [key, value]) => {
        const match = key.match(parameterPattern)
        if (!match) {
          return acc
        }
        const prefix = match[1]
        if (!include.some((i) => i === getLocationFromPrefix(prefix))) {
          return acc
        }
        const propertyName = match[2]
        const [property, ...rest] = propertyName.split('.')
        return {
          ...acc,
          [property]: this.explodeParam(rest, value, acc[property] || {}),
        }
      },
      {} as Record<string, any>,
    )
  }

  private explodeParam(
    keys: string[],
    value: string,
    existingValue: Record<string, any>,
  ): Record<string, any> | string {
    if (keys.length === 0) {
      return value
    }
    const [key, ...rest] = keys
    return {
      ...existingValue,
      [key]: this.explodeParam(rest, value, existingValue[key] || {}),
    }
  }
}

class CURLCommandBuilder extends ManualCommandBuilder {
  public buildCommand(
    method: string | HttpMethod,
    url: string,
    operation: OpenAPIV3_1.OperationObject,
    params: Record<string, string> = {},
  ): string {
    const queryParameters = new URLSearchParams(
      this.getQueryParameters(operation, params),
    ).toString()
    const body = this.getBody(operation, params)
    const mediaType = this.getMediaType(operation)
    const bodyString =
      body && mediaType ? `-d '${this.encodeBody(body, mediaType)}'` : ''

    const hasSecurityScheme =
      operation.security && operation.security.length > 0

    const headers = [
      ...(mediaType ? [`-H "Content-Type: ${mediaType}"`] : []),
      '-H "Accept: application/json"',
      ...(hasSecurityScheme ? ['-H "Authorization: Bearer <token>"'] : []),
    ]

    return `curl -X ${method.toUpperCase()} \\
    ${this.getURL(url, operation, params)}${queryParameters ? '?' + queryParameters : ''} \\
    ${headers.join(' \\\n    ')} \\
    ${bodyString}`
  }

  private getURL(
    url: string,
    operation: OpenAPIV3_1.OperationObject,
    params: Record<string, string>,
  ): string {
    let resultURL = url
    const pathParameters = this.getPathParameters(operation, params)
    Object.entries(pathParameters).forEach(([key, value]) => {
      resultURL = resultURL.replace(`{${key}}`, value)
    })
    return resultURL
  }

  private encodeBody(body: Record<string, any>, mediaType: MediaType): string {
    if (mediaType === MediaType.JSON) {
      return JSON.stringify(body, null, 2)
    }
    if (mediaType === MediaType.FORM) {
      return new URLSearchParams(body as Record<string, string>).toString()
    }
    throw new Error(`Unsupported media type: ${mediaType}`)
  }
}

interface XCodeSamples {
  'x-codeSamples': {
    lang: string
    source: string
  }[]
}

const hasCodeSamples = (
  operation: OpenAPIV3_1.OperationObject,
): operation is OpenAPIV3_1.OperationObject<XCodeSamples> => {
  return 'x-codeSamples' in operation
}

class GeneratedCommandBuilder implements ICommandBuilder {
  private lang: string

  public constructor(lang: string) {
    this.lang = lang
  }

  public buildCommand(
    _method: string | HttpMethod,
    _url: string,
    operation: OpenAPIV3_1.OperationObject,
    _params: Record<string, string> = {},
  ): string {
    if (!hasCodeSamples(operation)) {
      return ''
    }

    const codeSample = operation['x-codeSamples'].find(
      (sample) => sample.lang === this.lang,
    )

    if (!codeSample) {
      return ''
    }

    return codeSample.source
  }
}

class PythonCommandBuilder extends GeneratedCommandBuilder {
  public constructor() {
    super('python')
  }
}

class JavaScriptCommandBuilder extends GeneratedCommandBuilder {
  public constructor() {
    super('typescript')
  }
}

export const COMMAND_BUILDERS: {
  lang: string
  displayName: string
  builder: ICommandBuilder
}[] = [
  {
    lang: 'bash',
    displayName: 'cURL',
    builder: new CURLCommandBuilder(),
  },
  {
    lang: 'javascript',
    displayName: 'JavaScript',
    builder: new JavaScriptCommandBuilder(),
  },
  {
    lang: 'python',
    displayName: 'Python',
    builder: new PythonCommandBuilder(),
  },
]

enum APITags {
  documented = 'documented',
  featured = 'featured',
  issue_funding = 'issue_funding',
}

export interface APISection {
  name: string
  endpoints: {
    id: string
    name: string
    path: string
    method: HttpMethod
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

export const isIssueFundingEndpoint = (
  endpoint: OpenAPIV3_1.OperationObject,
): boolean => {
  if (!endpoint.tags) {
    return false
  }
  return endpoint.tags.includes(APITags.issue_funding)
}

export const isOtherEndpoint = (
  endpoint: OpenAPIV3_1.OperationObject,
): boolean => !isFeaturedEndpoint(endpoint) && !isIssueFundingEndpoint(endpoint)

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
    for (const method of Object.values(HttpMethod)) {
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

export interface SelectorWidgetSchema {
  resourceRoot: string
  resourceName: string
  displayProperty: string
}

export type SchemaObjectWithSelectorWidget = OpenAPIV3_1.SchemaObject & {
  'x-polar-selector-widget': SelectorWidgetSchema
}

export const hasSelectorWidget = (
  schema: OpenAPIV3_1.SchemaObject,
): schema is SchemaObjectWithSelectorWidget =>
  'x-polar-selector-widget' in schema
