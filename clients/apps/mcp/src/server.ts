import { McpServer } from '@modelcontextprotocol/server'
import { Effect } from 'effect'
import { version } from '../package.json'
import type { ToolMode } from './clients'
import { instructionsFor } from './instructions'
import { RequestLog } from './log'
import type { PolarApiOutboundProps } from './outbound'
import { registerDocsTools } from './tools/docs'
import { registerExecuteTool } from './tools/execute'
import { registerFeedbackTool } from './tools/feedback'
import { registerOperationTools } from './tools/operations'
import { registerSearchTool } from './tools/search'

export const createServer = Effect.fn('createServer')(function* (
  props: PolarApiOutboundProps,
  toolMode: ToolMode,
) {
  const { telemetry } = yield* RequestLog
  const server = new McpServer(
    { name: 'polar', version },
    { instructions: instructionsFor(toolMode, telemetry) },
  )
  server.server.registerCapabilities({ tools: { listChanged: false } })
  if (toolMode === 'operations') {
    yield* registerOperationTools(server, props)
  } else {
    yield* registerSearchTool(server)
    yield* registerExecuteTool(server, props)
  }
  yield* registerDocsTools(server)
  if (telemetry) {
    yield* registerFeedbackTool(server)
  }
  return server
})
