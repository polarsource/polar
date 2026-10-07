import { McpServer } from '@modelcontextprotocol/server'
import type { PolarApiOutboundProps } from './outbound'
import { registerExecuteTool } from './tools/execute'
import { registerSearchTool } from './tools/search'

export const createServer = (props: PolarApiOutboundProps) => {
  const server = new McpServer({ name: 'polar', version: '0.1.0' })
  server.server.registerCapabilities({ tools: { listChanged: false } })
  registerSearchTool(server)
  registerExecuteTool(server, props)
  return server
}
