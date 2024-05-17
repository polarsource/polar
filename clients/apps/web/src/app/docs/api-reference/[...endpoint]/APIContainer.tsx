'use client'

import { CONFIG } from '@/utils/config'
import { ContentPasteOutlined } from '@mui/icons-material'
import { OpenAPIV3_1 } from 'openapi-types'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { useCallback, useMemo } from 'react'

export const requestBodyParameters = (
  endpoint: OpenAPIV3_1.OperationObject,
) => {
  return (
    endpoint.requestBody &&
    'content' in endpoint.requestBody &&
    endpoint.requestBody.content &&
    'application/json' in endpoint.requestBody.content &&
    endpoint.requestBody.content['application/json'] &&
    'schema' in endpoint.requestBody.content['application/json'] &&
    endpoint.requestBody.content['application/json'].schema &&
    'properties' in endpoint.requestBody.content['application/json'].schema &&
    endpoint.requestBody.content['application/json'].schema.properties
  )
}

export const APIContainer = ({
  endpoint,
  path,
  method,
}: {
  endpoint: OpenAPIV3_1.OperationObject
  path: string
  method: string
}) => {
  const triggerClassName = 'py-1'

  const buildCurlCommand = useCallback(
    (
      method: string = 'GET',
      url: string,
      endpoint: OpenAPIV3_1.OperationObject,
    ) => {
      const requestParameters = requestBodyParameters(endpoint)
      const requiredBodyParameters = requestParameters
        ? Object.entries(requestParameters)
            .map(([key]) => ({
              [key]: `<${key}>`,
            }))
            .reduce((acc, curr) => ({ ...acc, ...curr }), {})
        : undefined

      const bodyParametersString = requiredBodyParameters
        ? `-d '${JSON.stringify(requiredBodyParameters, null, 2)}'`
        : ''

      return `curl -X ${method.toUpperCase()} \\
${url} \\
-H "Content-type: application/json" \\
-H "Accept: application/json" \\
-H "Authorization: Bearer <token>" \\
${bodyParametersString}`
    },
    [],
  )

  const copyCodeToClipboard = useCallback((snippet: string) => {
    navigator.clipboard.writeText(snippet)
  }, [])

  const curlCommand = useMemo(
    () => buildCurlCommand(method, `${CONFIG.BASE_URL}/${path}`, endpoint),
    [method, path, buildCurlCommand, endpoint],
  )

  const handleCopyToClipboard = useCallback(() => {
    copyCodeToClipboard(curlCommand)
  }, [copyCodeToClipboard, curlCommand])

  return (
    <div className="dark:bg-polar-900 flex h-full w-full flex-col rounded-2xl bg-white shadow-sm">
      <Tabs defaultValue="curl">
        <TabsList className="dark:border-polar-800 flex w-full flex-row items-center gap-x-4 rounded-none border-b border-gray-100 px-4 py-3 md:justify-between">
          <div className="flex flex-row items-center">
            <TabsTrigger className={triggerClassName} value="curl" size="small">
              cURL
            </TabsTrigger>
          </div>
          <Button
            className="dark:text-polar-500 text-gray-500 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
            variant="ghost"
            size="icon"
            onClick={handleCopyToClipboard}
          >
            <ContentPasteOutlined className="h-4 w-4" />
          </Button>
        </TabsList>
        <TabsContent value="curl" className="p-2 py-0">
          <pre className="dark:text-polar-50 select-text overflow-auto p-4 font-mono text-xs leading-normal text-gray-900">
            {curlCommand}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  )
}
