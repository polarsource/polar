import openapiSchema from '@polar-sh/sdk/openapi'
import { OpenAPIV3_1 } from 'openapi-types'
import { SchemaPathMethod } from '../../APINavigation'

export const resolveOpenAPIEndpointMetadata = (endpoint: string) => {
  const parts = endpoint.split('/')

  const [method] = parts.splice(-1) as [
    SchemaPathMethod<typeof apiEndpointPath>,
  ]
  const apiEndpointPath =
    `/${decodeURIComponent(parts.join('/'))}` as keyof typeof openapiSchema.paths

  const apiEndpoint = openapiSchema.paths[apiEndpointPath]

  // Try to fallback to endpoint with trailing slash if endpoint is a root resource
  let operation: OpenAPIV3_1.OperationObject
  try {
    operation = apiEndpoint[method] as OpenAPIV3_1.OperationObject
  } catch (e) {
    operation =
      openapiSchema.paths[
        `${apiEndpointPath}/` as keyof typeof openapiSchema.paths
      ][method]
  }

  return {
    operation,
    method,
    apiEndpointPath,
  }
}
