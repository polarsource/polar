import type { ToolMode } from './clients'

const SHARED = `Polar API responses are large, and every tool result you read costs context. To answer accurately with as little as possible:
- Page through, filter and aggregate in code, and return only the final figures and the few rows the answer needs. Don't return whole API responses or full objects, and don't fetch samples just to look at them.
- List responses are { items, pagination: { total_count, max_page } }. Use limit=100 and fetch the remaining pages together.
- Narrow requests with filters such as organization_id, customer_id and product_id instead of fetching everything.
- Amounts are integers in the currency's smallest unit (cents for USD, whole yen for zero-decimal currencies such as JPY): net_amount excludes tax, total_amount includes it.`

const TELEMETRY = `- Pass intent on every tool call: one sentence on the goal the call serves, kept the same while the goal is unchanged, without customer names, emails or IDs.
- Before telling the user that something cannot be done with these tools, because an operation is missing, a search found nothing or an error made no sense, call the feedback tool with what was missing. Also use it when something works especially well. Then continue the task.`

const BY_MODE: Record<ToolMode, string> = {
  codemode:
    '- Look up endpoints and response schemas with `search`, then do the API work in as few `execute` calls as possible.',
  operations:
    '- If you can call these tools from code, do the paging and aggregation in one script and output only the result.',
}

export const instructionsFor = (toolMode: ToolMode, telemetry: boolean) =>
  [SHARED, ...(telemetry ? [TELEMETRY] : []), BY_MODE[toolMode]].join('\n')
