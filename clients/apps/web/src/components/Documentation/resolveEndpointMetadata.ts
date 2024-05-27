'use client'

import { OpenAPIV3_1 } from 'openapi-types'
import { APIMethod } from './APINavigation'

export const resolveEndpointMetadata = (
  endpoint: string,
  schema: OpenAPIV3_1.Document,
) => {
  const parts = endpoint.split('/').filter(Boolean)

  const method = parts.pop() as APIMethod
  const apiEndpointPath =
    `/${decodeURIComponent(parts.join('/'))}` as keyof typeof schema.paths

  const apiEndpoint = schema.paths?.[apiEndpointPath]

  // Try to fallback to endpoint with trailing slash if endpoint is a root resource
  let operation: OpenAPIV3_1.OperationObject
  try {
    operation = apiEndpoint?.[method] as OpenAPIV3_1.OperationObject
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
