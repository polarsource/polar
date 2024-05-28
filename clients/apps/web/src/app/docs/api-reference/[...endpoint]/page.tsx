'use client'

import { useDocumentationContext } from '@/components/Documentation/DocumentationProvider'
import { MDXContentWrapper } from '@/components/Documentation/MDXContentWrapper'
import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import { useMemo } from 'react'
import { APIContainer } from '../../../../components/CommandPalette/containers/APIContainer'
import { BodyParameters } from '../../../../components/Documentation/BodyParameters'
import { Parameters } from '../../../../components/Documentation/Parameters'
import { ResponseContainer } from '../../../../components/Documentation/ResponseContainer'
import { resolveEndpointMetadata } from '../../../../components/Documentation/resolveEndpointMetadata'

export default function Page({
  params: { endpoint },
}: {
  params: { endpoint: string[] }
}) {
  const { schema } = useDocumentationContext()

  const metadata = schema
    ? resolveEndpointMetadata(
        endpoint.join('/'),
        schema as unknown as OpenAPIV3_1.Document,
      )
    : undefined

  const { operation, method, apiEndpointPath } = metadata ?? {
    operation: null,
    method: null,
    apiEndpointPath: null,
  }

  const requestBodyParameters = useMemo(() => {
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
  }, [operation])

  if (!operation) return null

  const subHeader = endpoint[2].replaceAll('_', ' ')

  return (
    <>
      <div className="flex w-full max-w-3xl flex-shrink flex-col">
        <div className="flex flex-col gap-y-16">
          <div className="flex flex-col gap-y-4">
            <span className="text-lg capitalize text-blue-500 dark:text-blue-400">
              {subHeader}
            </span>
            <h1 className="text-4xl font-medium leading-normal text-black dark:text-white">
              {operation.summary}
            </h1>
            <div className="flex flex-row items-center gap-x-4">
              <span className="dark:bg-polar-700 rounded-md bg-gray-200/50 px-2 py-1 font-mono text-xs font-normal uppercase">
                {method ?? 'Unknown Method'}
              </span>
              <pre className="w-fit font-mono text-sm">{apiEndpointPath}</pre>
            </div>
          </div>
          <MDXContentWrapper>
            <Markdown>{operation.description ?? ''}</Markdown>
          </MDXContentWrapper>

          {operation.parameters && (
            <Parameters
              parameters={operation.parameters as OpenAPIV3_1.ParameterObject[]}
            />
          )}

          {requestBodyParameters && (
            // @ts-ignore
            <BodyParameters parameters={requestBodyParameters} />
          )}
        </div>
      </div>
      <div className="flex w-full flex-shrink-0 flex-col gap-y-8 md:w-96">
        <APIContainer
          className="bg-gray-50"
          operation={operation}
          method={method}
          path={apiEndpointPath}
        />
        {operation.responses && (
          <ResponseContainer responses={operation.responses} />
        )}
      </div>
    </>
  )
}
