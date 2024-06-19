import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import { HeadingObserver } from './HeadingObserver'
import { MDXContentWrapper } from './MDXContentWrapper'
import {
  generateSchemaExample,
  getRequestBodySchema,
  isDereferenced,
} from './openapi'

const Webhook = ({
  event,
  webhook,
}: {
  event: string
  webhook: OpenAPIV3_1.OperationObject
}) => {
  const bodySchema = getRequestBodySchema(webhook)
  return (
    <>
      <HeadingObserver type="h2" id={event}>
        {webhook.summary}
      </HeadingObserver>
      <MDXContentWrapper>
        <Markdown>{webhook.description ?? ''}</Markdown>
      </MDXContentWrapper>
      {bodySchema && (
        <pre className="select-text overflow-auto p-4 font-mono text-xs leading-normal text-gray-900 dark:text-white">
          {JSON.stringify(generateSchemaExample(bodySchema), null, 2)}
        </pre>
      )}
    </>
  )
}

const Webhooks = ({ schema }: { schema: OpenAPIV3_1.Document }) => {
  const webhooks = schema.webhooks
    ? Object.entries(schema.webhooks)
        .reduce<[string, OpenAPIV3_1.OperationObject][]>(
          (acc, [event, webhook]) => {
            if (isDereferenced(webhook) && webhook.post) {
              return [...acc, [event, webhook.post]]
            }
            return acc
          },
          [],
        )
        .sort(([a], [b]) => a.localeCompare(b))
    : []

  return (
    <>
      {webhooks.map(([event, webhook]) => (
        <Webhook key={event} event={event} webhook={webhook} />
      ))}
    </>
  )
}

export default Webhooks
