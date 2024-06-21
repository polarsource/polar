import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import SyntaxHighlighterServer, {
  Highlighter,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterServer'
import { generateSchemaExample } from './openapi'

export const ResponseContainer = ({
  responses,
  highlighter,
}: {
  responses: OpenAPIV3_1.ResponsesObject
  highlighter: Highlighter
}) => {
  const triggerClassName = 'py-1'

  return (
    <div className="dark:border-polar-700 flex h-full w-full flex-col rounded-3xl bg-white shadow-sm dark:border dark:bg-transparent dark:shadow-none">
      <Tabs defaultValue={Object.keys(responses)[0]}>
        <div className="dark:border-polar-700 flex w-full flex-row items-center justify-between border-b border-gray-100 px-5 py-1">
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
              className="p-4 text-xs"
            >
              {schema ? (
                <SyntaxHighlighterServer
                  lang="json"
                  code={JSON.stringify(generateSchemaExample(schema), null, 2)}
                  highlighter={highlighter}
                />
              ) : undefined}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
