import { env, waitUntil } from 'cloudflare:workers'
import { version } from '../package.json'
import generatedTools from './generated/tools.json'
import type { RequestLogEntry } from './log'

const CAPTURE_URL = 'https://us.i.posthog.com/capture/'

export const toolNames = new Set([
  'search',
  'execute',
  'search_docs',
  'read_docs_page',
  ...generatedTools.map(({ name }) => name),
])
const MAX_ERROR_MESSAGE_CHARS = 1_000
const USER_AGENT_PRODUCT = /^([^\s/]+)(?:\/(\S+))?/

export const subjectFor = async (account: string) => {
  const secret: string = env.MCP_ANALYTICS_SECRET
  if (!secret) return undefined
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(account),
  )
  return [...new Uint8Array(signature).slice(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const errorType = ({ isError, errorKind, apiStatus }: RequestLogEntry) => {
  if (isError === undefined) return 'validation'
  if (!isError) return undefined
  if (errorKind === 'api' && apiStatus !== undefined) {
    if (apiStatus === 401 || apiStatus === 403) return 'permission'
    if (apiStatus === 429) return 'rate_limited'
    if (apiStatus === 422) return 'validation'
    return apiStatus >= 500 ? 'api_5xx' : 'api_4xx'
  }
  return errorKind === 'script' || errorKind === 'cancelled'
    ? undefined
    : 'internal'
}

export const captureToolCall = (entry: RequestLogEntry) => {
  const apiKey: string = env.POSTHOG_PROJECT_KEY
  if (
    !apiKey ||
    !entry.telemetry ||
    entry.rpcMethod !== 'tools/call' ||
    !entry.subject
  )
    return
  const product = USER_AGENT_PRODUCT.exec(entry.userAgent ?? '')
  const event = {
    api_key: apiKey,
    event: '$mcp_tool_call',
    distinct_id: `mcp:${entry.subject}`,
    properties: {
      $mcp_tool_name:
        entry.tool && toolNames.has(entry.tool) ? entry.tool : 'unknown',
      $mcp_is_error: entry.isError ?? true,
      $mcp_error_type: errorType(entry),
      $mcp_error_status: entry.apiStatus,
      $mcp_error_message: entry.errorMessage?.slice(0, MAX_ERROR_MESSAGE_CHARS),
      api_error_fields: entry.apiErrorFields,
      $mcp_duration_ms: entry.durationMs,
      $mcp_client_name: entry.client?.name ?? product?.[1],
      $mcp_client_version: entry.client?.version ?? product?.[2],
      user_agent: entry.userAgent,
      $mcp_server_name: 'polar',
      $mcp_server_version: version,
      server: entry.server,
      mode: entry.mode,
      read_only: entry.readOnly,
      error_kind: entry.errorKind,
      script_error: entry.scriptError,
      result_chars: entry.resultChars,
      truncated: entry.truncated,
      empty_result: entry.emptyResult,
      api_requests: entry.apiRequests,
      api_operations: entry.apiOperations,
      unexposed_operations: entry.unexposedOperations,
      $process_person_profile: false,
      $geoip_disable: true,
    },
  }
  waitUntil(
    fetch(CAPTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).then(
      () => undefined,
      () => undefined,
    ),
  )
}
