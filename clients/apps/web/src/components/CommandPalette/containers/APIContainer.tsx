import { CONFIG } from '@/utils/config'
import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { twMerge } from 'tailwind-merge'

import {
  CURLCommandBuilder,
  NodeJSCommandBuilder,
} from '@/components/Documentation/openapi'
import { SyntaxHighlighterClient } from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'

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
  const triggerClassName = 'py-1'
  const curlCommand = new CURLCommandBuilder(
    method,
    `${CONFIG.BASE_URL}${path}`,
    operation,
  ).buildCommand()
  const nodeJSCommand = new NodeJSCommandBuilder(
    method,
    `${CONFIG.BASE_URL}${path}`,
    operation,
  ).buildCommand()

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 rounded-4xl flex h-full w-full flex-col bg-white shadow-sm dark:border dark:bg-transparent dark:shadow-none',
        className,
      )}
    >
      <Tabs defaultValue="curl">
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
        </TabsList>
        <TabsContent value="curl" className="p-4 text-xs">
          <SyntaxHighlighterClient lang="bash" code={curlCommand} />
        </TabsContent>
        <TabsContent value="nodejs" className="p-4 text-xs">
          <SyntaxHighlighterClient lang="js" code={nodeJSCommand} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
