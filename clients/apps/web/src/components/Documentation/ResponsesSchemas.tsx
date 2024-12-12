import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import AnchoredElement from './AnchoredElement'
import ProseWrapper from './ProseWrapper'
import { Schema } from './Schema'
import { isDereferenced } from './openapi'

export const ResponsesSchemas = ({
  responses,
}: {
  responses: OpenAPIV3_1.ResponsesObject
}) => {
  const responseSchemas = Object.entries(responses).reduce(
    (acc, [key, value]) => {
      if (
        isDereferenced(value) &&
        value.content?.['application/json']?.schema
      ) {
        return { ...acc, [key]: value.content['application/json'].schema }
      }
      return acc
    },
    {} as Record<string, OpenAPIV3_1.SchemaObject>,
  )

  return (
    <div className="flex flex-col gap-y-6">
      <AnchoredElement id="responses">
        <h3 className="group text-xl text-black dark:text-white">Responses</h3>
      </AnchoredElement>

      <Tabs defaultValue={Object.keys(responseSchemas)[0]}>
        <div className="overflow-x-auto">
          <TabsList defaultValue="schema_0">
            {Object.keys(responseSchemas).map((statusCode) => (
              <TabsTrigger
                key={`response-tabs-${statusCode}`}
                value={statusCode}
              >
                {statusCode}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {Object.entries(responseSchemas).map(([statusCode, schema]) => (
          <TabsContent
            key={`response-tabs-content-${statusCode}`}
            value={statusCode}
          >
            <div className="flex flex-col gap-y-4">
              {responses[statusCode].description && (
                <ProseWrapper className="text-sm">
                  <Markdown>
                    {responses[statusCode].description as string}
                  </Markdown>
                </ProseWrapper>
              )}
              <Schema schema={schema} idPrefix={['responses', statusCode]} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
