import type { McpServer } from '@modelcontextprotocol/server'
import { Effect, Schema } from 'effect'
import { Docs } from '../docs'
import { makeToolRunner } from '../results'

export const registerDocsTools = Effect.fn('registerDocsTools')(function* (
  server: McpServer,
) {
  const runTool = yield* makeToolRunner
  const docs = yield* Docs
  server.registerTool(
    'search_docs',
    {
      title: 'Search the Polar docs',
      description:
        'Search the Polar documentation for guides, concepts and integration examples, e.g. checkout, usage-based billing, webhooks, customer portal, SDKs and framework adapters. Returns matching sections with their page; read a whole page with read_docs_page.',
      inputSchema: Schema.Struct({
        query: Schema.String.annotate({
          description: 'What to search for, in natural language or keywords',
        }),
      }).pipe(Schema.toStandardSchemaV1, Schema.toStandardJSONSchemaV1),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    ({ query }, context) => runTool(docs.search(query), context.mcpReq.signal),
  )
  server.registerTool(
    'read_docs_page',
    {
      title: 'Read a Polar docs page',
      description:
        'Read a whole Polar documentation page as markdown, by the page returned from search_docs, e.g. `features/checkout/links`.',
      inputSchema: Schema.Struct({
        page: Schema.String.annotate({
          description: 'Page path or URL, e.g. `features/checkout/links`',
        }),
      }).pipe(Schema.toStandardSchemaV1, Schema.toStandardJSONSchemaV1),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    ({ page }, context) => runTool(docs.readPage(page), context.mcpReq.signal),
  )
})
