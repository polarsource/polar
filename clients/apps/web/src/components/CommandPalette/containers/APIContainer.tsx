import { CONFIG } from '@/utils/config'
import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { twMerge } from 'tailwind-merge'

import { COMMAND_BUILDERS } from '@/components/Documentation/openapi'
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

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 rounded-4xl flex h-full w-full flex-col bg-gray-50 shadow-sm dark:border dark:bg-transparent dark:shadow-none',
        className,
      )}
    >
      <Tabs defaultValue={COMMAND_BUILDERS[0].lang}>
        <TabsList className="dark:border-polar-700 flex w-full flex-row items-center justify-between gap-x-4 rounded-none border-b border-gray-200 px-4 py-3">
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
              <SyntaxHighlighterClient
                lang={lang}
                code={builder.buildCommand(
                  method,
                  `${CONFIG.BASE_URL}${path}`,
                  operation,
                  undefined,
                )}
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
