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
import { generateSchemaExample, isDereferenced } from './openapi'

export const ResponseContainer = ({
  responses,
  highlighter,
}: {
  responses: OpenAPIV3_1.ResponsesObject
  highlighter: Highlighter
}) => {
  const triggerClassName = 'py-1'

  const responsesExamples = Object.entries(responses).reduce<
    [string, string][]
  >((acc, [statusCode, response]) => {
    const schema =
      'content' in response &&
      response.content?.['application/json'].schema &&
      'schema' in response.content['application/json'] &&
      response.content['application/json'].schema
    if (schema && isDereferenced(schema)) {
      const example = generateSchemaExample(schema)
      const stringifiedExample = JSON.stringify(example, null, 2)
      return [...acc, [statusCode, stringifiedExample]]
    }
    return acc
  }, [])

  return (
    <div className="dark:border-polar-700 rounded-4xl flex h-full w-full flex-col bg-gray-50 shadow-sm dark:border dark:bg-transparent dark:shadow-none">
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

        {responsesExamples.map(([statusCode, example]) => (
          <TabsContent
            key={statusCode}
            value={statusCode}
            className="max-h-80 overflow-y-auto p-4 text-xs"
          >
            <SyntaxHighlighterServer
              lang="json"
              code={example}
              highlighter={highlighter}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
