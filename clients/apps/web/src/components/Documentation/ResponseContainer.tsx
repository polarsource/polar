'use client'

import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { resolveValue } from './schemaResolver'

export const ResponseContainer = ({
  responses,
}: {
  responses: OpenAPIV3_1.ResponsesObject
}) => {
  const triggerClassName = 'py-1'

  return (
    <div className="dark:bg-polar-900 flex h-full w-full flex-col rounded-3xl bg-gray-50 shadow-sm">
      <Tabs defaultValue={Object.keys(responses)[0]}>
        <div className="dark:border-polar-800 flex w-full flex-row items-center justify-between border-b border-gray-100 px-5 py-1">
          <span className="text-sm text-black dark:text-white">Responses</span>
          <TabsList className="flex flex-row items-center rounded-none py-3">
            {Object.keys(responses).map((statusCode) => (
              <TabsTrigger
                key={statusCode}
                className={triggerClassName}
                value={statusCode}
                size="small"
              >
                {statusCode}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {Object.entries(responses).map(([statusCode, response]) => {
          const schema =
            'content' in response &&
            response.content?.['application/json'].schema &&
            'schema' in response.content['application/json'] &&
            response.content['application/json'].schema

          return (
            <TabsContent
              key={statusCode}
              value={statusCode}
              className="p-2 py-0"
            >
              {schema ? (
                <pre className="dark:text-polar-50 max-h-72 select-text overflow-auto p-4 font-mono text-xs leading-normal text-gray-900">
                  {JSON.stringify(resolveValue(schema), null, 2)}
                </pre>
              ) : undefined}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
