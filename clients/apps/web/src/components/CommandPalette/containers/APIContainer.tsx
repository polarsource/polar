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

import SyntaxHighlighter from '@/components/SyntaxHighlighter/SyntaxHighlighter'
import {
  Theme,
  polarDark,
  polarLight,
} from '@/components/SyntaxHighlighter/themes'
import { useTheme } from 'next-themes'

const getBodyExample = (endpoint: OpenAPIV3_1.OperationObject) => {
  const schema = getRequestBodySchema(endpoint)
  return schema ? generateSchemaExample(schema) : undefined
}

const getParametersExample = (
  endpoint: OpenAPIV3_1.OperationObject,
  include: ('path' | 'query')[],
) => {
  if (!endpoint.parameters) {
    return undefined
  }
  return endpoint.parameters.reduce(
    (acc, parameter) => {
      if (
        isDereferenced(parameter) &&
        parameter.required &&
        include.some((i) => i === parameter.in) &&
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
  const parametersExample = getParametersExample(endpoint, ['query'])
  const queryParametersString = new URLSearchParams(
    parametersExample,
  ).toString()

  const bodyExample = getBodyExample(endpoint)
  const bodyString = bodyExample
    ? `-d '${JSON.stringify(bodyExample, null, 2)}'`
    : ''

  return `curl -X ${method.toUpperCase()} \\
${url}${queryParametersString ? '?' + queryParametersString : ''} \\
-H "Content-type: application/json" \\
-H "Accept: application/json" \\
-H "Authorization: Bearer <token>" \\
${bodyString}`
}

const buildNodeJSCommand = (endpoint: OpenAPIV3_1.OperationObject) => {
  const [namespace, endpointName] = endpoint.operationId?.split(':') ?? ['', '']

  const snakeToCamel = (str: string) =>
    str
      .toLowerCase()
      .replace(/([-_][a-z])/g, (group: string) =>
        group.toUpperCase().replace('-', '').replace('_', ''),
      )

  const titleToCamel = (str: string) => {
    const joined = str.split(' ').join('')
    return joined.charAt(0).toLowerCase() + joined.slice(1)
  }

  const objectToString = (obj: any, indent: number = 0): string => {
    const indentBase = '  '
    let result = '{\n'
    const entries = Object.entries(obj)

    entries.forEach(([key, value], index) => {
      const isLast = index === entries.length - 1
      const lineIndent = indentBase.repeat(indent + 1)
      const nextIndent = indent + 1
      let valueString

      if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value !== null
      ) {
        valueString = objectToString(value, nextIndent)
      } else if (Array.isArray(value)) {
        valueString = `[${value
          .map((v) => {
            if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
              return objectToString(v, nextIndent)
            } else if (typeof v === 'string') {
              return `'${v}'`
            } else {
              return v
            }
          })
          .join(', ')}]`
      } else if (typeof value === 'string') {
        valueString = `'${value}'`
      } else {
        valueString = value
      }

      result += `${lineIndent}${key}: ${valueString}${isLast ? '' : ','}\n`
    })

    result += `${indentBase.repeat(indent)}}`
    return result
  }

  const convertToCamelCase = (obj: Record<string, any>): Record<string, any> =>
    Object.keys(obj).reduce(
      (acc, key) => {
        const newKey = snakeToCamel(key)
        return {
          ...acc,
          [newKey]: obj[key],
        }
      },
      {} as Record<string, any>,
    )

  const parametersExamples = getParametersExample(endpoint, ['path', 'query'])
  const bodySchema = getRequestBodySchema(endpoint)
  const bodyExample = bodySchema ? generateSchemaExample(bodySchema) : undefined
  const bodyTitle =
    bodySchema &&
    isDereferenced(bodySchema) &&
    bodySchema.title &&
    titleToCamel(bodySchema.title)

  const requestParameters = {
    ...(parametersExamples ? convertToCamelCase(parametersExamples) : {}),
    ...(bodySchema && isDereferenced(bodySchema) && bodyExample
      ? {
          [bodyTitle || 'body']: bodyExample,
        }
      : {}),
  }

  return `import { PolarAPI, Configuration } from '@polar-sh/sdk';

const polar = new PolarAPI(
    new Configuration({
        headers: {
            'Authorization': \`Bearer \${process.env.POLAR_ACCESS_TOKEN}\`
        }
    })
);

polar.${namespace}.${snakeToCamel(endpointName)}(${objectToString(requestParameters)})
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
  const { resolvedTheme } = useTheme()
  const baseTheme = resolvedTheme === 'dark' ? polarDark : polarLight
  const syntaxHighlighterTheme: Theme = {
    ...baseTheme,
    base: {
      ...baseTheme.base,
      background: 'transparent',
    },
  }

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
        <TabsContent value="curl" className="p-2 py-0 text-xs">
          <SyntaxHighlighter
            language="bash"
            code={curlCommand}
            theme={syntaxHighlighterTheme}
          />
        </TabsContent>
        <TabsContent value="nodejs" className="p-2 py-0 text-xs">
          <SyntaxHighlighter
            language="js"
            code={nodeJSCommand}
            theme={syntaxHighlighterTheme}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
