import ProseWrapper from '@/components/Documentation/ProseWrapper'
import { TableOfContents } from '@/components/Documentation/TableOfContents'
import {
  fetchSchema,
  generateSchemaExample,
  getRequestBodySchema,
  getWebhook,
} from '@/components/Documentation/openapi'
import SyntaxHighlighterServer, {
  Highlighter,
  getHighlighter,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import Markdown from 'markdown-to-jsx'
import { notFound } from 'next/navigation'
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
      <h1 id={event}>{webhook.summary}</h1>
      <Markdown>{webhook.description ?? ''}</Markdown>
      <p className="font-semibold">Raw format payload</p>
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

export default async function Page({
  params: { event },
}: {
  params: { event: string[] }
}) {
  const highlighter = await getHighlighter()
  const schema = await fetchSchema()

  const eventName = event[0]
  const webhook = getWebhook(eventName, schema)
  if (!webhook) {
    return notFound()
  }

  const tocItems: TocItem[] = [
    {
      value: eventName,
      href: `#${eventName}`,
      depth: 1,
      numbering: [1],
      parent: 'root',
    },
  ]

  return (
    <>
      <article className="flex w-full max-w-3xl flex-shrink flex-col">
        <ProseWrapper>
          <Webhook
            event={eventName}
            webhook={webhook}
            highlighter={highlighter}
          />
        </ProseWrapper>
      </article>
      <TableOfContents items={tocItems} />
    </>
  )
}

export const metadata = {
  title: 'Webhook Events',
  description: 'The list of events we may send to your webhook endpoint',
  keywords: 'webhooks, events, payload, payload structure',
}
