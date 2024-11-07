import ProseWrapper from '@/components/Documentation/ProseWrapper'
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
import { notFound } from 'next/navigation'
import Markdown from 'markdown-to-jsx'
import { OpenAPIV3_1 } from 'openapi-types'

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
  params: { event }
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
    </>
  )
}

export const metadata = {
  title: 'Webhook Events',
  description: 'The list of events we may send to your webhook endpoint',
  keywords: 'webhooks, events, payload, payload structure',
}
