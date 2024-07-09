import ProseWrapper from '@/components/Documentation/ProseWrapper'
import { TableOfContents } from '@/components/Documentation/TableOfContents'
import {
  fetchSchema,
  generateSchemaExample,
  getRequestBodySchema,
  isDereferenced,
} from '@/components/Documentation/openapi'
import SyntaxHighlighterServer, {
  Highlighter,
  getHighlighter,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'
import type { TocItem } from 'remark-flexible-toc'

export const dynamic = 'force-static'

const Webhook = ({
  event,
  webhook,
  highlighter,
}: {
  event: string
  webhook: OpenAPIV3_1.OperationObject
  highlighter: Highlighter
}) => {
  const bodySchema = getRequestBodySchema(webhook)
  return (
    <>
      <h2 id={event}>{webhook.summary}</h2>
      <Markdown>{webhook.description ?? ''}</Markdown>
      {bodySchema && (
        <SyntaxHighlighterServer
          highlighter={highlighter}
          lang="json"
          code={JSON.stringify(generateSchemaExample(bodySchema[0]), null, 2)}
        />
      )}
    </>
  )
}

export default async function Page() {
  const highlighter = await getHighlighter()
  const schema = await fetchSchema()
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

  const tocItems: TocItem[] = [
    {
      value: 'Webhook events',
      href: '#webhook-events',
      depth: 1,
      numbering: [1],
      parent: 'root',
    },
    ...webhooks.map<TocItem>(([event, webhook], index) => ({
      value: webhook.summary ?? event,
      href: `#${event}`,
      depth: 2,
      numbering: [1, index],
      parent: 'root',
    })),
  ]

  return (
    <>
      <article className="flex w-full max-w-3xl flex-shrink flex-col">
        <ProseWrapper>
          <h1 id="webhook-events">Webhook events</h1>
          <p>
            You&apos;ll find below the list of events we may send to your
            webhook endpoint, along with their payload structure.
          </p>
          {webhooks.map(([event, webhook]) => (
            <Webhook
              key={event}
              event={event}
              webhook={webhook}
              highlighter={highlighter}
            />
          ))}
        </ProseWrapper>
      </article>
      <TableOfContents items={tocItems} />
    </>
  )
}
