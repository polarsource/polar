import openapiSchema from '@polar-sh/sdk/openapi'
import { APIParameter, SchemaPathKey } from '../../APINavigation'

export default function Page({
  params: { endpoint },
}: {
  params: { endpoint: string[] }
}) {
  const [method] = endpoint.splice(-1)
  const apiEndpointPath = decodeURIComponent(endpoint.join('/'))
  const apiEndpoint =
    openapiSchema.paths[`/${apiEndpointPath}` as SchemaPathKey]

  // @ts-ignore
  const endpointMethod = apiEndpoint[method]

  if (!endpointMethod) return null

  const subHeader = apiEndpointPath.split('/')[2].replaceAll('_', ' ')

  return (
    <div className="flex flex-col gap-y-16">
      <div className="flex flex-col gap-y-4">
        <span className="dark:text-polar-500 text-lg capitalize text-gray-500">
          {subHeader}
        </span>
        <h1 className="text-4xl font-medium leading-normal text-black dark:text-white">
          {endpointMethod.summary}
        </h1>
        <div className="flex flex-row items-center gap-x-4">
          <span className="dark:bg-polar-700 rounded-sm bg-gray-200 px-2 py-1 font-mono text-xs font-normal uppercase">
            {method}
          </span>
          <pre className="w-fit font-mono text-sm">/{apiEndpointPath}</pre>
        </div>
      </div>

      {endpointMethod.parameters && (
        <Parameters parameters={endpointMethod.parameters} />
      )}
    </div>
  )
}

const Parameters = ({ parameters }: { parameters: APIParameter[] }) => {
  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-2xl text-black dark:text-white">Parameters</h3>

      <div className="flex flex-col gap-y-4">
        {parameters.map((parameter, index) => (
          <div
            key={index}
            className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl bg-gray-100 p-8"
          >
            <span className="dark:text-polar-200 text-sm text-gray-700">
              {parameter.schema.title}
            </span>
            <div className="flex flex-row items-center gap-x-2">
              <span className="text-lg font-medium text-black dark:text-white">
                {parameter.name}
              </span>
              <span className="dark:bg-polar-700 rounded-sm bg-gray-200 px-2 py-1 font-mono text-xs font-normal capitalize">
                {parameter.in} Parameter
              </span>
            </div>
            <p className="dark:text-polar-300 text-sm text-gray-600">
              {parameter.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
