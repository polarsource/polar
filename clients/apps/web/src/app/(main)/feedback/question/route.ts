import { getAuthenticatedUser } from '@/utils/user'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
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
import { z } from 'zod'

import {
  dedupeByPath,
  fetchMintlifyPageContent,
  MINTLIFY_DOMAIN,
  searchMintlify,
} from './mintlify'

const MAX_STEPS = 10

const google = createGoogleGenerativeAI({
  apiKey: process.env.PYDANTIC_AI_GATEWAY_API_KEY,
  headers: {
    Authorization: `Bearer ${process.env.PYDANTIC_AI_GATEWAY_API_KEY}`,
  },
  baseURL: 'https://gateway-us.pydantic.dev/proxy/google-vertex/',
})

const ANSWER_SYSTEM_PROMPT = `You are the Polar support assistant. You answer the user's questions about Polar in a chat. The user can ask follow-up questions, so respond conversationally.

You have three tools:
- \`search\`: search the Polar docs by an English query. Returns pages with short excerpts and a \`path\`.
- \`fetchPageContent\`: fetch the full Markdown content of a documentation page by its \`path\` (which must come from a search result).
- \`escalateToHuman\`: hand the conversation off to a human support agent. Pass a concise \`summary\` describing the user's question and what you've already tried. Use this when:
  - The user explicitly asks for a human / support / to talk to someone.
  - The fetched docs do not cover the question and the user still needs an answer.
  - The question is account-specific (refund, missing payout, billing dispute, account access) that docs cannot resolve.
  - After two unsuccessful attempts to answer, the user is still unsatisfied.

Workflow for answering:
1. If the documentation already fetched earlier in this conversation contains the answer, use it directly without re-fetching.
2. Otherwise, call \`search\` with a concise English query. Translate non-English questions to English. You may search up to 3 times if results aren't useful.
3. Pick the most relevant page from the results and call \`fetchPageContent\` on it. The search excerpts alone are not enough — writing an answer from excerpts will hallucinate.
4. Write your answer grounded in the fetched content. Do not invent details that aren't in fetched pages.

When you call \`escalateToHuman\`, do not write any text after the tool call. The UI takes over and shows the user an editable summary they can send to support.

Guidelines for replies:
- Be concise and friendly.
- If the fetched docs don't cover the question, say so honestly instead of guessing — and consider whether to escalate.
- Use Markdown for emphasis, lists, and inline code. Do not use headings.
- When linking to a documentation page, always write the link as \`[Page Title](https://polar.sh/docs/<path>)\` with a short, human-readable page title as the visible label. Derive the title from the fetched page content (its first H1 heading) or from the search result; if no obvious title is available, write a short descriptive label of 3–6 words. Never use the URL or the raw path as the visible link text — links like \`[https://polar.sh/docs/installation](https://polar.sh/docs/installation)\` or \`[/installation](...)\` are not allowed. Never link to a bare path like \`(installation)\` or \`(/installation)\`. \`<path>\` is the value of the \`path\` field from the search/fetch result, without a leading slash.`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const mintlifyApiKey = process.env.MINTLIFY_ASSISTANT_API_KEY
  if (!mintlifyApiKey) {
    return new Response('Mintlify assistant not configured', { status: 503 })
  }

  if (!process.env.PYDANTIC_AI_GATEWAY_API_KEY) {
    return new Response('AI gateway not configured', { status: 503 })
  }

  let messages: UIMessage[]
  try {
    const body = (await req.json()) as { messages: UIMessage[] }
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return new Response('Invalid request', { status: 400 })
    }
    messages = body.messages
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const gemini = google('gemini-3.1-flash-lite-preview')

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
        const results = dedupeByPath(
          await searchMintlify(mintlifyApiKey, MINTLIFY_DOMAIN, query),
        )
        console.log('[feedback/question] search:', { query, results })
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
        const page = await fetchMintlifyPageContent(
          mintlifyApiKey,
          MINTLIFY_DOMAIN,
          path,
        )
        if (!page) {
          return {
            ok: false as const,
            error: `Could not fetch page content for "${path}".`,
          }
        }
        console.log('[feedback/question] fetchPageContent:', {
          path: page.path,
          contentPreview: page.content.slice(0, 200),
        })
        return { ok: true as const, path: page.path, content: page.content }
      },
    })

    const escalateToHuman = tool({
      description:
        'Hand the conversation off to a human support agent. Use this when the user explicitly asks for a human, when the docs cannot answer their question, or when the issue is account-specific (refund, payout, billing dispute, account access). After calling this tool, do not write any further text — the UI takes over.',
      inputSchema: z.object({
        summary: z
          .string()
          .min(1)
          .max(2000)
          .describe(
            "A concise summary of the user's request and what you've tried, written for a human support agent.",
          ),
      }),
      execute: async ({ summary }) => {
        console.log('[feedback/question] escalateToHuman:', { summary })
        return { summary }
      },
    })

    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: gemini,
      system: ANSWER_SYSTEM_PROMPT,
      messages: modelMessages,
      tools: { search, fetchPageContent, escalateToHuman },
      stopWhen: [stepCountIs(MAX_STEPS), hasToolCall('escalateToHuman')],
      experimental_transform: smoothStream(),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[feedback/question] handler threw:', error)
    Sentry.captureException(error)
    return new Response(
      `Feedback question handler failed: ${(error as Error).message}`,
      { status: 502 },
    )
  }
}
