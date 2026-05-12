import { getServerSideAPI } from '@/utils/client/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { createAnthropic } from '@ai-sdk/anthropic'
import * as Sentry from '@sentry/nextjs'
import {
  convertToModelMessages,
  hasToolCall,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ALLOWED_DASHBOARD_PATHS } from './dashboardPaths'
import { fetchMintlifyPageContent, searchMintlify } from './mintlify'
import { flushPostHog, wrapWithTracing } from './posthog'

const MAX_STEPS = 10
const MAX_BODY_BYTES = 256 * 1024
const MAX_MESSAGES = 10

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(MAX_MESSAGES),
  conversationId: z.string().min(1).max(64).optional(),
  organizationId: z.string().min(1).max(64).optional(),
})

const anthropic = createAnthropic({
  apiKey: process.env.PYDANTIC_AI_GATEWAY_API_KEY,
  baseURL: 'https://gateway-us.pydantic.dev/proxy/anthropic/v1/',
})

const formattedDashboardPaths = ALLOWED_DASHBOARD_PATHS.map((path) =>
  path === '' ? '- (empty — dashboard home)' : `- ${path}`,
).join('\n')

const ANSWER_SYSTEM_PROMPT = `You are the Polar support assistant. You answer the user's questions about Polar in a chat. The user can ask follow-up questions, so respond conversationally.

You have three tools:
- \`search\`: search the Polar docs by an English query. Returns pages with short excerpts and a \`path\`.
- \`fetchPageContent\`: fetch the full Markdown content of a documentation page by its \`path\` (which must come from a search result).
- \`escalateToHuman\`: open the escalation panel so the user can hand the conversation to the Polar team. Pick the right \`type\` (question / feedback / bug). Use this when:
  - The user explicitly asks for a human / support / to talk to someone.
  - The fetched docs do not cover the question and the user still needs an answer.
  - The question is account-specific (refund, missing payout, billing dispute, account access) that docs cannot resolve.
  - After two unsuccessful attempts to answer, the user is still unsatisfied.
  - The user is reporting a bug or unexpected behavior — pass \`type: "bug"\`.
  - The user is sharing product feedback or a feature request — pass \`type: "feedback"\`.

Never proactively offer to escalate or to draft a message to the support team after you have already given a workable answer. Escalation only happens when the user explicitly asks for a human, or when the conversation is clearly stuck after repeated attempts — not as a courtesy after a good reply.

Workflow for answering:
1. If the documentation already fetched earlier in this conversation contains the answer, use it directly without re-fetching.
2. Otherwise, call \`search\` with a concise English query. Translate non-English questions to English. You may search up to 3 times if results aren't useful.
3. Before calling \`fetchPageContent\`, filter the search results. Pick the page that is most likely to give a generic, platform-level answer to the user's question.
   - Skip framework- / SDK- / integration-specific pages when the user did not mention that stack. Treat result paths that include framework or product names (e.g. \`integrate/nextjs\`, \`integrate/astro\`, \`integrate/react\`, \`integrate/javascript-sdk\`, \`integrate/python-sdk\`, \`integrate/stripe\`, \`integrate/better-auth\`, \`integrate/discord\`, \`integrate/github\`, \`webhooks/...\` example code) as integration-specific and DO NOT fetch them unless the user's original question mentioned that exact framework, SDK, language, or integration.
   - Reading an integration-specific page when the user asked a generic question pollutes your context and pushes you toward a stack-specific answer — actively avoid this.
   - If the only relevant results look integration-specific and the user did not name a stack, refine your search query (e.g. drop framework terms, search for the underlying Polar concept) before resorting to fetching a stack-specific page.
   - If after refinement the docs only offer integration-specific coverage of the topic and the user has not named a stack, say so plainly in your reply rather than picking one stack on their behalf.
4. Call \`fetchPageContent\` on the chosen page. The search excerpts alone are not enough — writing an answer from excerpts will hallucinate.
5. Write your answer grounded in the fetched content. Do not invent details that aren't in fetched pages. Even if the fetched page happens to contain stack-specific examples, keep the reply itself platform-level unless the user explicitly asked about that stack.

When you escalate, first write a brief, warm message in the chat (one or two short sentences) telling the user you'll connect them with the Polar team and that they can add anything else they'd like to share before sending. Make it clear they still need to click Send — never imply the request has already been sent, is already with support, or is "on its way". Don't restate their question. Then call \`escalateToHuman\` with the correct \`type\` — the full conversation transcript is attached automatically. Do not write any text after the tool call — the UI takes over and shows the user an empty textarea where they can optionally add a note before clicking Send.

Guidelines for replies:
- Be concise and friendly.
- If the fetched docs don't cover the question, say so honestly instead of guessing — and consider whether to escalate.
- Use Markdown for emphasis, lists, and inline code, but never use Markdown headings (\`#\`, \`##\`, etc.).
- Do not reply with code unless the user has explicitly asked for code or pasted code into the conversation. This includes code blocks, snippets, request/response payloads, CLI invocations, and configuration files. If a fetched docs page contains code, paraphrase what it does in plain words and let the user follow up if they want the snippet.
- Do not reply with integration- or framework-specific guidance (e.g. Next.js, React, Astro, Stripe, BetterAuth, GitHub, Discord, the JavaScript SDK, the Python SDK, webhooks code) unless the user has explicitly asked about that integration or framework. Keep the initial answer generic — describe how Polar handles the topic at the platform level — and let the user follow up if they want details for their stack.
- Example: if the user asks "how do I set a redirect URL?", explain at a high level what a redirect URL is in Polar and where it is configured. Do not show SDK examples, Next.js handlers, or webhook code unless they explicitly ask.
- When linking to a documentation page, always write the link as \`[Page Title](https://polar.sh/docs/<path>)\` with a short, human-readable page title as the visible label. Derive the title from the fetched page content (its first H1 heading) or from the search result; if no obvious title is available, write a short descriptive label of 3–6 words. Never use the URL or the raw path as the visible link text — links like \`[https://polar.sh/docs/installation](https://polar.sh/docs/installation)\` or \`[/installation](...)\` are not allowed. Never link to a bare path like \`(installation)\` or \`(/installation)\`. \`<path>\` is the value of the \`path\` field from the search/fetch result, without a leading slash.

Linking to the Polar dashboard:
- The user is signed in to a Polar dashboard. To deep-link them to a page in their own dashboard, use the RELATIVE URL \`/to/dashboard/<path>\` (no scheme, no host). Always start with a single leading slash. Relative URLs are required so the link resolves against the current environment (dev, staging, production, sandbox) — never hardcode \`https://polar.sh\` or any other host.
- The \`/to/dashboard/...\` redirector resolves the user's active organization slug automatically — never include or guess an organization slug.
- Only use \`<path>\` values from the allow-list below. If the page the user needs is not in the list, do not invent a path and do not link — describe the navigation in words instead (e.g. "open Settings → Webhooks").
- Never link to detail pages that require an ID (a specific product, customer, subscription, etc.). If the user is asking about a specific record, describe how to find it instead of linking.
- Never link to the Polar homepage as a fallback. If you cannot link to a relevant dashboard or documentation page, simply do not include a link.
- Use the \`[Page Title](URL)\` format with a short, human-readable label — never the URL itself.

Allowed dashboard paths (trailing portion after \`/to/dashboard/\`):
${formattedDashboardPaths}`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mintlifyApiKey = process.env.MINTLIFY_ASSISTANT_API_KEY
  if (!mintlifyApiKey || !process.env.PYDANTIC_AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: 'Assistant not configured' },
      { status: 503 },
    )
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { conversationId, organizationId } = parsed.data
  const messages = parsed.data.messages as UIMessage[]

  // Only forward `organizationId` to PostHog grouping if the caller is
  // actually a member — otherwise users can pollute other orgs' analytics.
  let trustedOrganizationId: string | undefined
  if (organizationId) {
    const api = await getServerSideAPI()
    const userOrganizations = await getUserOrganizations(api)
    if (userOrganizations.some((org) => org.id === organizationId)) {
      trustedOrganizationId = organizationId
    }
  }

  const sonnet = wrapWithTracing(anthropic('claude-sonnet-4-6'), {
    userId: user.id,
    conversationId,
    organizationId: trustedOrganizationId,
  })

  try {
    const search = tool({
      description:
        'Search the Polar documentation. Returns a list of relevant pages with short excerpts and a `path` you can pass to `fetchPageContent`. Use English queries; translate the user question to English first if needed.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .max(200)
          .describe('A concise English search query.'),
      }),
      execute: async ({ query }) => {
        const results = await searchMintlify(mintlifyApiKey, query)
        return { query, results }
      },
    })

    const fetchPageContent = tool({
      description:
        'Fetch the full Markdown content of a Polar documentation page by its path. The `path` argument must come from a search result.',
      inputSchema: z.object({
        path: z
          .string()
          .min(1)
          .describe(
            'The page path/slug returned by the search results (e.g. the value of the `path` field).',
          ),
      }),
      execute: async ({ path }) => {
        const page = await fetchMintlifyPageContent(mintlifyApiKey, path)
        if (!page) {
          return {
            ok: false as const,
            error: `Could not fetch page content for "${path}".`,
          }
        }
        return { ok: true as const, path: page.path, content: page.content }
      },
    })

    const escalateToHuman = tool({
      description:
        'Open the escalation panel so the user can hand the conversation off to the Polar team. Calling this tool does NOT submit anything — it surfaces an empty textarea where the user can optionally add anything else they want to share, pick the right category, and then click Send themselves. The full conversation transcript is attached automatically. Use this for any request you cannot resolve in the chat: support questions, bug reports, feature feedback. After calling this tool, do not write any further text — the UI takes over.',
      inputSchema: z.object({
        type: z
          .enum(['question', 'feedback', 'bug'])
          .describe(
            'The category that best fits the user\'s message. Use "bug" when the user is reporting something broken, an error, or behavior that doesn\'t match what they expected. Use "feedback" when the user is suggesting a feature, an improvement, or sharing an opinion about the product. Use "question" for everything else, including account-specific issues (refunds, payouts, billing disputes, access) and general support questions.',
          ),
      }),
      execute: async ({ type }) => ({ type }),
    })

    const modelMessages = await convertToModelMessages(messages)
    // On the last allowed turn, restrict the toolset to `escalateToHuman` and
    // force it — the model writes a brief handoff message before the call.
    const forceEscalation = messages.length >= MAX_MESSAGES - 1

    const result = streamText({
      model: sonnet,
      messages: [
        {
          role: 'system',
          content: ANSWER_SYSTEM_PROMPT,
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
        ...modelMessages,
      ],
      tools: forceEscalation
        ? { escalateToHuman }
        : { search, fetchPageContent, escalateToHuman },
      toolChoice: forceEscalation
        ? { type: 'tool', toolName: 'escalateToHuman' }
        : 'auto',
      stopWhen: [stepCountIs(MAX_STEPS), hasToolCall('escalateToHuman')],
      experimental_transform: smoothStream(),
      onFinish: () => flushPostHog(),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 502 })
  }
}
