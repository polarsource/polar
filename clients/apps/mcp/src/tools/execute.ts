import type { McpServer } from '@modelcontextprotocol/server'
import { exports } from 'cloudflare:workers'
import { z } from 'zod'
import type { PolarApiOutboundProps } from '../outbound'
import { runInSandbox, toolError, toolResult } from '../sandbox'

const EXECUTE_LIMITS = { cpuMs: 10_000, subRequests: 50 }

const polarClient = (apiUrl: string) => `
const polar = {
  async request({ method = 'GET', path, query, body }) {
    const url = new URL(path, ${JSON.stringify(apiUrl)})
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue
      for (const item of Array.isArray(value) ? value : [value]) {
        url.searchParams.append(key, String(item))
      }
    }
    const response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!response.ok) {
      throw new Error('Polar API ' + response.status + ': ' + (typeof data === 'string' ? data : JSON.stringify(data)))
    }
    return data
  },
}
`

const description = (
  readOnly: boolean,
) => `Call the Polar API by writing JavaScript. Use the search tool first to find operations and their parameters and schemas.${readOnly ? '\n\nThis connection is read-only: only GET requests are allowed.' : ''}

Available in your code:

declare const polar: {
  request<T = unknown>(options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' // defaults to GET
    path: string // a spec path with its parameters filled in, e.g. \`/v1/products/\${productId}\`
    query?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>
    body?: unknown // sent as JSON
  }): Promise<T> // throws on non-2xx responses with the status and error body
}

- List operations are paginated with the \`page\` and \`limit\` query parameters and return { items, pagination: { total_count, max_page } }.
- Most operations accept an \`organization_id\`. If you don't know it, list the organizations you can access with GET /v1/organizations/.
- Your code must be an async arrow function that returns a JSON-serialisable result. Return only the fields you need: results are truncated past ~6,000 tokens.

Example:

async () => {
  const { items } = await polar.request({ path: '/v1/products/', query: { is_archived: false, limit: 100 } })
  return items.map(({ id, name, prices }) => ({ id, name, prices: prices.map((price) => price.amount_type) }))
}`

export const registerExecuteTool = (
  server: McpServer,
  props: PolarApiOutboundProps,
) => {
  server.registerTool(
    'execute',
    {
      title: 'Call the Polar API',
      description: description(props.readOnly),
      inputSchema: z.object({
        code: z
          .string()
          .describe(
            'JavaScript async arrow function that calls the API with `polar.request`',
          ),
      }),
      annotations: {
        readOnlyHint: props.readOnly,
        destructiveHint: !props.readOnly,
        openWorldHint: true,
      },
    },
    async ({ code }) => {
      try {
        return toolResult(
          await runInSandbox({
            code,
            prelude: polarClient(props.apiUrl),
            globalOutbound: exports.PolarApiOutbound({ props }),
            limits: EXECUTE_LIMITS,
          }),
        )
      } catch (error) {
        return toolError(error)
      }
    },
  )
}
