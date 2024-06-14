'use client'

import {
  generateSchemaExample,
  getRequestBodySchema,
  isDereferenced,
} from '@/components/Documentation/openapi'
import { CONFIG } from '@/utils/config'
import { CheckOutlined, FileCopyOutlined } from '@mui/icons-material'
import { AnimatePresence, motion } from 'framer-motion'
import { OpenAPIV3_1 } from 'openapi-types'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const requestBodyParameters = (endpoint: OpenAPIV3_1.OperationObject) => {
  const schema = getRequestBodySchema(endpoint)
  return schema ? generateSchemaExample(schema) : undefined
}

const getQueryParametersExamples = (endpoint: OpenAPIV3_1.OperationObject) => {
  if (!endpoint.parameters) {
    return undefined
  }
  return endpoint.parameters.reduce(
    (acc, parameter) => {
      if (
        isDereferenced(parameter) &&
        parameter.required &&
        parameter.in === 'query' &&
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

const buildCurlCommand = (
  method: string = 'GET',
  url: string,
  endpoint: OpenAPIV3_1.OperationObject,
) => {
  const queryParametersExamples = getQueryParametersExamples(endpoint)
  const queryParametersString = new URLSearchParams(
    queryParametersExamples,
  ).toString()

  const requestParameters = requestBodyParameters(endpoint)
  const requiredBodyParameters = requestParameters

  const bodyParametersString = requiredBodyParameters
    ? `-d '${JSON.stringify(requiredBodyParameters, null, 2)}'`
    : ''

  return `curl -X ${method.toUpperCase()} \\
${url}${queryParametersString ? '?' + queryParametersString : ''} \\
-H "Content-type: application/json" \\
-H "Accept: application/json" \\
-H "Authorization: Bearer <token>" \\
${bodyParametersString}`
}

const buildNodeJSCommand = (endpoint: OpenAPIV3_1.OperationObject) => {
  const [namespace, endpointName] = endpoint.operationId?.split(':') ?? ['', '']

  const snakeToCamel = (str: string) =>
    str
      .toLowerCase()
      .replace(/([-_][a-z])/g, (group: string) =>
        group.toUpperCase().replace('-', '').replace('_', ''),
      )

  return `import { PolarAPI, Configuration } from '@polar-sh/sdk';

const polar = new PolarAPI(
    new Configuration({
        headers: {
            'Authorization': \`Bearer \${process.env.POLAR_ACCESS_TOKEN}\`
        }
    })
);

polar.${namespace}.${snakeToCamel(endpointName)}()
  .then(console.log)
  .catch(console.error);
`
}

export const APIContainer = ({
  className,
  operation,
  path,
  method,
}: {
  className?: string
  operation: OpenAPIV3_1.OperationObject
  path: string
  method: string
}) => {
  const [currentTab, setCurrentTab] = useState<'curl' | 'nodejs'>('curl')
  const [didCopy, setDidCopy] = useState(false)

  const triggerClassName = 'py-1'

  const copyCodeToClipboard = useCallback((snippet: string) => {
    navigator.clipboard.writeText(snippet)
  }, [])

  const curlCommand = useMemo(
    () => buildCurlCommand(method, `${CONFIG.BASE_URL}${path}`, operation),
    [method, path, operation],
  )

  const nodeJSCommand = useMemo(
    () => buildNodeJSCommand(operation),
    [operation],
  )

  const handleCopyToClipboard = useCallback(() => {
    copyCodeToClipboard(currentTab === 'curl' ? curlCommand : nodeJSCommand)
    setDidCopy(true)

    setTimeout(() => {
      setDidCopy(false)
    }, 2000)
  }, [copyCodeToClipboard, curlCommand, nodeJSCommand, currentTab, setDidCopy])

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 flex h-full w-full flex-col rounded-3xl bg-white shadow-sm dark:border dark:bg-transparent dark:shadow-none',
        className,
      )}
    >
      <Tabs
        defaultValue="curl"
        onValueChange={(v) => setCurrentTab(v as 'curl' | 'nodejs')}
      >
        <TabsList className="dark:border-polar-700 flex w-full flex-row items-center justify-between gap-x-4 rounded-none border-b border-gray-100 px-4 py-3">
          <div className="flex w-full flex-row items-center">
            <TabsTrigger className={triggerClassName} value="curl" size="small">
              cURL
            </TabsTrigger>
            <TabsTrigger
              className={triggerClassName}
              value="nodejs"
              size="small"
            >
              NodeJS
            </TabsTrigger>
          </div>
          <Button
            className="dark:text-polar-500 text-gray-500 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
            variant="ghost"
            size="icon"
            onClick={handleCopyToClipboard}
          >
            <AnimatePresence mode="popLayout">
              {didCopy ? (
                <motion.div
                  key={0}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CheckOutlined className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key={1}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <FileCopyOutlined className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </TabsList>
        <TabsContent value="curl" className="p-2 py-0">
          <pre className="select-text overflow-auto p-4 font-mono text-xs leading-normal text-gray-900 dark:text-white">
            {curlCommand}
          </pre>
        </TabsContent>
        <TabsContent value="nodejs" className="p-2 py-0">
          <pre className="select-text overflow-auto p-4 font-mono text-xs leading-normal text-gray-900 dark:text-white">
            {nodeJSCommand}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  )
}
