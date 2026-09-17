import { tool, type ToolSet } from 'ai'
import { z } from 'zod'

type Page = {
  url: string
  title: string
  snippet: string
  body: string
}

const WEB: readonly Page[] = [
  {
    url: 'https://docs.polar.sh/introduce',
    title: 'Polar — payments for developers',
    snippet:
      'Polar is merchant-of-record payments: products, checkouts, subscriptions, and usage meters.',
    body: 'Polar bills customers for products and meters. Organizations hold a credit or cash balance. Members and agents can spend from a shared pool when the org enables it.',
  },
  {
    url: 'https://docs.polar.sh/features/usage-based-billing',
    title: 'Usage-based billing',
    snippet:
      'Meters ingest events and fold them into a subscription. Credits are one way to cap spend.',
    body: 'A meter counts events in a period. Credits mode converts tokens or API calls into a budget. When remaining hits zero, further calls are denied until the period resets or the cap is raised.',
  },
  {
    url: 'https://platform.openai.com/docs/guides/tools',
    title: 'Tool use in chat agents',
    snippet:
      'Models call tools to search, read files, run code, and take actions, then continue the turn.',
    body: 'Expose a small, general tool set to every agent. Specialize with the system prompt, not a private toolbelt. Multi-step loops run until the model stops calling tools.',
  },
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
    title: 'JavaScript guide — MDN',
    snippet: 'Language overview: values, functions, async, and modules.',
    body: 'JavaScript is the language of the web. Use it for scripts, CLIs, and sandboxed interpreters. console.log writes to stdout in most runtimes.',
  },
  {
    url: 'https://en.wikipedia.org/wiki/Large_language_model',
    title: 'Large language model — Wikipedia',
    snippet:
      'LLMs predict tokens. Cost tracks input and output tokens; caching and routing change the bill.',
    body: 'A completion spends input tokens (the prompt and tool results) and output tokens (the reply and tool calls). Activity mix is which kind of work those tokens paid for.',
  },
]

const files = new Map<string, string>([
  [
    'README.md',
    '# Acme\n\nShared workspace for every agent. Search the web, keep notes here, mail people when something needs a human.\n',
  ],
  [
    'notes/standup.md',
    '# Standup\n\n- Credits pool is 100,000 / month.\n- Members have their own caps.\n- Agents are reusable; specialize them with a system prompt.\n',
  ],
])

const mailbox: { id: string; to: string; subject: string }[] = []

const terms = (query: string) =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1)

const matches = (query: string, ...parts: string[]) => {
  const hay = parts.join('\n').toLowerCase()
  return terms(query).some((term) => hay.includes(term))
}

const printed = (code: string) =>
  [...code.matchAll(/(?:console\.log|print)\((['"`])([\s\S]*?)\1\)/g)].map(
    (match) => match[2],
  )

export const tools: ToolSet = {
  search_web: tool({
    description:
      'Search the public web. Returns titles, URLs, and snippets. Pass a URL to read_url for the full page.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Search query.'),
    }),
    execute: async ({ query }) => ({
      query,
      results: WEB.filter((page) =>
        matches(query, page.title, page.snippet, page.body, page.url),
      ).map(({ url, title, snippet }) => ({ url, title, snippet })),
    }),
  }),
  read_url: tool({
    description:
      'Fetch the text of a web page. Use a URL from search_web or one the user provided.',
    inputSchema: z.object({
      url: z.string().url().describe('Absolute http(s) URL.'),
    }),
    execute: async ({ url }) => {
      const page = WEB.find((item) => item.url === url)
      if (!page) return { ok: false as const, error: `No content for ${url}` }
      return {
        ok: true as const,
        url: page.url,
        title: page.title,
        body: page.body,
      }
    },
  }),
  list_files: tool({
    description: 'List files in the shared workspace.',
    inputSchema: z.object({}),
    execute: async () => ({ paths: [...files.keys()] }),
  }),
  read_file: tool({
    description: 'Read a file from the shared workspace.',
    inputSchema: z.object({
      path: z
        .string()
        .min(1)
        .describe('Workspace path, e.g. notes/standup.md.'),
    }),
    execute: async ({ path }) => {
      const content = files.get(path)
      if (content === undefined)
        return { ok: false as const, error: `No file at ${path}` }
      return { ok: true as const, path, content }
    },
  }),
  write_file: tool({
    description:
      'Create or overwrite a file in the shared workspace. Use this to save drafts, notes, code, or other artifacts.',
    inputSchema: z.object({
      path: z.string().min(1),
      content: z.string(),
    }),
    execute: async ({ path, content }) => {
      files.set(path, content)
      return { path, bytes: content.length }
    },
  }),
  edit_file: tool({
    description:
      'Replace one occurrence of text in a workspace file. Prefer this over rewriting the whole file.',
    inputSchema: z.object({
      path: z.string().min(1),
      old_string: z.string().min(1),
      new_string: z.string(),
    }),
    execute: async ({ path, old_string, new_string }) => {
      const content = files.get(path)
      if (content === undefined)
        return { ok: false as const, error: `No file at ${path}` }
      const index = content.indexOf(old_string)
      if (index === -1)
        return { ok: false as const, error: 'old_string not found' }
      files.set(
        path,
        content.slice(0, index) +
          new_string +
          content.slice(index + old_string.length),
      )
      return { ok: true as const, path }
    },
  }),
  run_code: tool({
    description:
      'Run a short program in a sandbox. Use for calculations, transforms, and checking snippets.',
    inputSchema: z.object({
      language: z.enum(['javascript', 'python']),
      code: z.string().min(1),
    }),
    execute: async ({ language, code }) => {
      const stdout = printed(code)
      return {
        language,
        stdout: stdout.length > 0 ? stdout.join('\n') : '(no output)',
        stderr: '',
      }
    },
  }),
  send_email: tool({
    description:
      'Send an email. Use when the user asked to notify someone or mail a draft. Does not wait for a reply.',
    inputSchema: z.object({
      to: z.string().email(),
      subject: z.string().min(1),
      body: z.string().min(1),
    }),
    execute: async ({ to, subject, body }) => {
      const id = `msg_${mailbox.length + 1}`
      mailbox.push({ id, to, subject })
      return { id, to, subject, bytes: body.length, status: 'queued' as const }
    },
  }),
}
