import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { twMerge } from 'tailwind-merge'

import SyntaxHighlighterServer, {
  Highlighter,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import { CONFIG } from '@/utils/config'
import { COMMAND_BUILDERS } from './openapi'

export const APIContainer = ({
  className,
  operation,
  path,
  method,
  highlighter,
  params,
}: {
  className?: string
  operation: OpenAPIV3_1.OperationObject
  path: string
  method: string
  highlighter: Highlighter
  params?: Record<string, any>
}) => {
  const triggerClassName = 'py-1'

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 rounded-4xl flex h-full w-full flex-col bg-gray-50 shadow-sm dark:border dark:bg-transparent dark:shadow-none',
        className,
      )}
    >
      <Tabs defaultValue={COMMAND_BUILDERS[0].lang}>
        <TabsList className="dark:border-polar-700 flex w-full flex-row items-center justify-between gap-x-4 rounded-none border-b border-gray-100 px-4 py-3">
          <div className="flex w-full flex-row items-center">
            {COMMAND_BUILDERS.map(({ lang, displayName }) => {
              return (
                <TabsTrigger
                  key={lang}
                  className={triggerClassName}
                  value={lang}
                  size="small"
                >
                  {displayName}
                </TabsTrigger>
              )
            })}
          </div>
        </TabsList>
        {COMMAND_BUILDERS.map(({ builder, lang }) => {
          return (
            <TabsContent key={lang} value={lang} className="p-4 text-xs">
              <SyntaxHighlighterServer
                highlighter={highlighter}
                lang={lang}
                code={builder.buildCommand(
                  method,
                  `${CONFIG.BASE_URL}${path}`,
                  operation,
                  params,
                )}
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
