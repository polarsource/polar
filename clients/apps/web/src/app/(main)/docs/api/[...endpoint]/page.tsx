import { APIContainer } from '@/components/Documentation/APIContainer'
import APILayout from '@/components/Documentation/APILayout'
import { AuthenticationSchema } from '@/components/Documentation/AuthenticationSchema'
import { BodySchema } from '@/components/Documentation/BodySchema'
import ProseWrapper from '@/components/Documentation/ProseWrapper'
import { ResponseContainer } from '@/components/Documentation/ResponseContainer'
import { ResponsesSchemas } from '@/components/Documentation/ResponsesSchemas'
import {
  EndpointError,
  EndpointMetadata,
  fetchSchema,
  getAPISections,
  getRequestBodySchema,
} from '@/components/Documentation/openapi'
import { getHighlighter } from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import Markdown from 'markdown-to-jsx'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OpenAPIV3_1 } from 'openapi-types'
import { Parameters } from '../../../../../components/Documentation/Parameters'
import { resolveEndpointMetadata } from '../../../../../components/Documentation/openapi'

export const dynamicParams = false

export async function generateStaticParams(): Promise<
  { endpoint: string[] }[]
> {
  const schema = await fetchSchema()
  const apiSections = getAPISections(schema)
  return apiSections.reduce<{ endpoint: string[] }[]>(
    (paths, { endpoints }) => [
      ...paths,
      ...endpoints.map(({ path, method }) => ({
        endpoint: [
          ...path
            .split('/')
            .filter((part) => !!part)
            .map(encodeURIComponent),
          method,
        ],
      })),
    ],
    [],
  )
}

export async function generateMetadata({
  params: { endpoint },
}: {
  params: { endpoint: string[] }
}): Promise<Metadata> {
  const schema = await fetchSchema()
  const metadata = resolveEndpointMetadata(endpoint, schema)

  return {
    title: metadata.operation?.summary ?? endpoint[0],
    description: metadata.operation?.description ?? '',
    keywords: [
      ...(metadata.operation?.tags ?? []),
      metadata.method,
      metadata.apiEndpointPath,
    ].join(', '),
    openGraph: {
      images: [
        `${process.env.NEXT_PUBLIC_FRONTEND_BASE_URL}/docs/og?${new URLSearchParams(
          {
            title: metadata.operation.summary ?? '',
            description: metadata.operation.description ?? '',
          },
        ).toString()}`,
      ],
    },
  }
}

export default async function Page({
  params: { endpoint },
  searchParams,
}: {
  params: { endpoint: string[] }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const schema = await fetchSchema()
  const highlighter = await getHighlighter()

  let metadata: EndpointMetadata
  try {
    metadata = resolveEndpointMetadata(endpoint, schema)
  } catch (e) {
    if (e instanceof EndpointError) {
      return notFound()
    }
    throw e
  }

  const { operation, method, apiEndpointPath } = metadata

  if (!operation) {
    return notFound()
  }

  const requestBodySchema = getRequestBodySchema(operation)
  const subHeader = operation.tags?.[0] ?? null

  return (
    <APILayout openAPISchema={schema} activeOperationId={operation.operationId}>
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

          <ProseWrapper>
            <Markdown>{operation.description ?? ''}</Markdown>
          </ProseWrapper>

          <AuthenticationSchema operation={operation} />

          {operation.parameters && (
            <Parameters
              parameters={operation.parameters as OpenAPIV3_1.ParameterObject[]}
            />
          )}

          {requestBodySchema && (
            <BodySchema
              schema={requestBodySchema[0]}
              mediaType={requestBodySchema[1]}
            />
          )}
          {operation.responses && (
            <ResponsesSchemas responses={operation.responses} />
          )}
        </div>
      </div>
      <div className="sticky top-12 flex w-full flex-shrink-0 flex-col gap-y-8 md:w-96">
        <APIContainer
          className="bg-gray-50"
          operation={operation}
          method={method}
          path={apiEndpointPath}
          highlighter={highlighter}
          params={searchParams}
        />
        {operation.responses && (
          <ResponseContainer
            responses={operation.responses}
            highlighter={highlighter}
          />
        )}
      </div>
    </APILayout>
  )
}
