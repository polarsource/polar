import openapiSchema from '@polar-sh/sdk/openapi'
import { OpenAPIV3_1 } from 'openapi-types'
import { PropsWithChildren, useCallback, useMemo } from 'react'
import { SchemaPathKey } from '../../APINavigation'
import { APIContainer } from './APIContainer'

export default function Page({
  params: { endpoint },
}: {
  params: { endpoint: string[] }
}) {
  const [method] = endpoint.splice(-1)
  const apiEndpointPath = decodeURIComponent(endpoint.join('/'))
  const apiEndpoint =
    openapiSchema.paths[`/${apiEndpointPath}` as SchemaPathKey]

  const endpointMethod = (apiEndpoint as OpenAPIV3_1.PathsObject)[
    method
  ] as OpenAPIV3_1.OperationObject

  const resolveSchema = useCallback((schemaName: string) => {
    return (openapiSchema as unknown as OpenAPIV3_1.Document).components
      ?.schemas?.[schemaName]
  }, [])

  const requestBodyParameters = useMemo(() => {
    if (
      endpointMethod.requestBody &&
      !('content' in endpointMethod.requestBody)
    )
      return undefined

    return resolveSchema(
      // @ts-ignore
      endpointMethod.requestBody?.content['application/json'].schema?.['$ref']
        .split('/')
        .pop(),
    )
  }, [endpointMethod, resolveSchema])

  if (!endpointMethod) return null

  const subHeader = apiEndpointPath.split('/')[2].replaceAll('_', ' ')

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
              <span className="dark:bg-polar-700 rounded-sm bg-gray-200/50 px-2 py-1 font-mono text-xs font-normal uppercase">
                {method}
              </span>
              <pre className="w-fit font-mono text-sm">/{apiEndpointPath}</pre>
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
            <BodyParameters parameters={requestBodyParameters} />
          )}
        </div>
      </div>
      <div className="sticky top-12 flex w-96 flex-shrink-0 flex-col">
        <APIContainer
          endpoint={endpointMethod}
          method={method}
          path={apiEndpointPath}
        />
      </div>
    </>
  )
}

const BodyParameters = ({
  parameters,
}: {
  parameters: OpenAPIV3_1.SchemaObject
}) => {
  const requiredProperties = parameters.required ?? []
  const properties =
    'properties' in parameters
      ? Object.entries(parameters.properties ?? {}).sort(([keyA], [keyB]) =>
          requiredProperties.includes(keyA) ===
          requiredProperties.includes(keyB)
            ? 0
            : requiredProperties.includes(keyA)
              ? -1
              : 1,
        )
      : []

  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-xl text-black dark:text-white">Body Parameters</h3>

      <div className="flex flex-col gap-y-4">
        {properties.map(
          ([key, property]: [
            key: string,
            property: OpenAPIV3_1.SchemaObject,
          ]) => (
            <ParameterItem key={key}>
              <div className="flex flex-row items-center gap-x-3">
                <span className="dark:text-polar-200 font-mono text-sm text-gray-700">
                  {key}
                </span>

                {requiredProperties.includes(key) && (
                  <span className="dark:bg-polar-700 text-xxs rounded-sm bg-gray-100 px-2 py-1 font-mono font-normal capitalize">
                    Required
                  </span>
                )}
              </div>
              <span className="text-lg font-medium text-black dark:text-white">
                {property.title}
              </span>
              {property.description && (
                <p className="dark:text-polar-300 text-sm leading-normal text-gray-600">
                  {property.description}
                </p>
              )}
            </ParameterItem>
          ),
        )}
      </div>
    </div>
  )
}

const Parameters = ({
  parameters,
}: {
  parameters: OpenAPIV3_1.ParameterObject[]
}) => {
  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-xl text-black dark:text-white">Parameters</h3>

      <div className="flex flex-col gap-y-4">
        {parameters.map((parameter, index) => (
          <ParameterItem key={index}>
            <div className="flex flex-row items-center gap-x-3">
              <span className="dark:text-polar-200 font-mono text-sm text-gray-700">
                {parameter.name}
              </span>
              <span className="dark:bg-polar-700 text-xxs rounded-sm bg-gray-100 px-2 py-1 font-mono font-normal capitalize">
                {parameter.in} Parameter
              </span>
            </div>

            <span className="text-lg font-medium text-black dark:text-white">
              {parameter.schema &&
                'title' in parameter.schema &&
                parameter.schema?.title}
            </span>

            {parameter.description && (
              <p className="dark:text-polar-300 text-sm leading-normal text-gray-600">
                {parameter.description}
              </p>
            )}
          </ParameterItem>
        ))}
      </div>
    </div>
  )
}

const ParameterItem = ({ children }: PropsWithChildren) => {
  return (
    <div className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl bg-white p-8 shadow-sm">
      {children}
    </div>
  )
}
