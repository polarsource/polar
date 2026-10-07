import { McpServer } from '@modelcontextprotocol/server'
import type { ToolMode } from './clients'
import type { PolarApiOutboundProps } from './outbound'
import { registerExecuteTool } from './tools/execute'
import { registerOperationTools } from './tools/operations'
import { registerSearchTool } from './tools/search'

export const createServer = (
  props: PolarApiOutboundProps,
  toolMode: ToolMode,
) => {
  const server = new McpServer({ name: 'polar', version: '0.1.0' })
  server.server.registerCapabilities({ tools: { listChanged: false } })
  if (toolMode === 'operations') {
    registerOperationTools(server, props)
  } else {
    registerSearchTool(server)
    registerExecuteTool(server, props)
  }
  return server
}
