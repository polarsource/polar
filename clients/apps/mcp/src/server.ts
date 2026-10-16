import { McpServer } from '@modelcontextprotocol/server'
import { Effect } from 'effect'
import { version } from '../package.json'
import type { ToolMode } from './clients'
import { instructionsFor } from './instructions'
import type { PolarApiOutboundProps } from './outbound'
import { registerDocsTools } from './tools/docs'
import { registerExecuteTool } from './tools/execute'
import { registerOperationTools } from './tools/operations'
import { registerSearchTool } from './tools/search'

export const createServer = Effect.fn('createServer')(function* (
  props: PolarApiOutboundProps,
  toolMode: ToolMode,
) {
  const server = new McpServer(
    { name: 'polar', version },
    { instructions: instructionsFor(toolMode) },
  )
  server.server.registerCapabilities({ tools: { listChanged: false } })
  if (toolMode === 'operations') {
    yield* registerOperationTools(server, props)
  } else {
    yield* registerSearchTool(server)
    yield* registerExecuteTool(server, props)
  }
  yield* registerDocsTools(server)
  return server
})
