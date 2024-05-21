import openapiSchema from '@polar-sh/sdk/openapi'
import { OpenAPIV3_1 } from 'openapi-types'
import { useMemo } from 'react'
import { SchemaPathMethod, resolveReference } from '../../APINavigation'
import { APIContainer } from './APIContainer'
import { BodyParameters } from './BodyParameters'
import { Parameters } from './Parameters'
import { ResponseContainer } from './ResponseContainer'

export default function Page({
  params: { endpoint },
}: {
  params: { endpoint: string[] }
}) {
  const [method] = endpoint.splice(-1) as [
    SchemaPathMethod<typeof apiEndpointPath>,
  ]
  const apiEndpointPath =
    `/${decodeURIComponent(endpoint.join('/'))}` as keyof typeof openapiSchema.paths

  const apiEndpoint = openapiSchema.paths[apiEndpointPath]

  // Try to fallback to endpoint with trailing slash if endpoint is a root resource
  let endpointMethod: OpenAPIV3_1.OperationObject
  try {
    endpointMethod = apiEndpoint[method] as OpenAPIV3_1.OperationObject
  } catch (e) {
    endpointMethod =
      openapiSchema.paths[
        `${apiEndpointPath}/` as keyof typeof openapiSchema.paths
      ][method]
  }

  const requestBodyParameters = useMemo(() => {
    if (
      endpointMethod.requestBody &&
      !('content' in endpointMethod.requestBody)
    ) {
      return undefined
    }

    const schema =
      endpointMethod.requestBody &&
      'schema' in endpointMethod.requestBody.content['application/json'] &&
      endpointMethod.requestBody.content['application/json'].schema &&
      '$ref' in endpointMethod.requestBody.content['application/json'].schema &&
      endpointMethod.requestBody.content['application/json'].schema

    return schema ? resolveReference(schema) : undefined
  }, [endpointMethod])

  if (!endpointMethod) return null

  const subHeader = apiEndpointPath.split('/')[3].replaceAll('_', ' ')

  return (
    <>
      <div className="flex w-full flex-shrink flex-col">
        <div className="flex flex-col gap-y-16">
          <div className="flex flex-col gap-y-4">
            <span className="text-lg capitalize text-black dark:text-white">
              {subHeader}
            </span>
            <h1 className="text-4xl font-medium leading-normal text-black dark:text-white">
              {endpointMethod.summary}
            </h1>
            <div className="flex flex-row items-center gap-x-4">
              <span className="dark:bg-polar-700 rounded-md bg-gray-200/50 px-2 py-1 font-mono text-xs font-normal uppercase">
                {method}
              </span>
              <pre className="w-fit font-mono text-sm">{apiEndpointPath}</pre>
            </div>
          </div>

          {endpointMethod.parameters && (
            <Parameters
              parameters={
                endpointMethod.parameters as OpenAPIV3_1.ParameterObject[]
              }
            />
          )}

          {requestBodyParameters && (
            // @ts-ignore
            <BodyParameters parameters={requestBodyParameters} />
          )}
        </div>
      </div>
      <div className="flex w-full flex-shrink-0 flex-col gap-y-8 md:sticky md:top-12 md:w-96">
        <APIContainer
          endpoint={endpointMethod}
          method={method}
          path={apiEndpointPath}
        />
        {endpointMethod.responses && (
          <ResponseContainer responses={endpointMethod.responses} />
        )}
      </div>
    </>
  )
}
