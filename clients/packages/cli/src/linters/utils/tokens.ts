import type { Language } from '@/linters/language'

export type Kind = 'code' | 'string' | 'comment'

export type Open = 'comment' | 'template' | undefined

export interface Span {
  readonly kind: Kind
  readonly text: string
}

export interface Tokens {
  readonly spans: ReadonlyArray<Span>
  readonly open: Open
}

export const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const STRING = `"(?:\\\\.|[^"\\\\])*"?|'(?:\\\\.|[^'\\\\])*'?`
const TEMPLATE_BODY = '(?:\\\\.|\\$\\{[^}]*\\}|[^`\\\\])*`?'
const TEMPLATE = `\`${TEMPLATE_BODY}`
const REGEXP = `(?<=(?:^|[(,=:[!&|?{};])\\s*)\\/(?:\\\\.|\\[(?:\\\\.|[^\\]\\\\])*\\]|[^/\\\\[])+\\/[a-z]*`
const EXPRESSION = /(\$\{[^}]*\})/
const TEMPLATE_CONTINUATION = new RegExp(`^${TEMPLATE_BODY}`)

const tokenPatterns = new Map<Language, RegExp>()

const tokenPattern = (language: Language) => {
  const cached = tokenPatterns.get(language)
  if (cached) return cached
  const { lineComment, blockComment } = language
  const comments = [
    `${escapeRegExp(lineComment)}.*`,
    ...(blockComment
      ? [
          `${escapeRegExp(blockComment[0])}[\\s\\S]*?(?:${escapeRegExp(blockComment[1])}|$)`,
        ]
      : []),
  ]
  const starts = escapeRegExp(`${lineComment[0]}${blockComment?.[0][0] ?? ''}`)
  const pattern = new RegExp(
    `${comments.join('|')}|${STRING}|${TEMPLATE}|${REGEXP}|[^'"\`/${starts}]+|[\\s\\S]`,
    'g',
  )
  tokenPatterns.set(language, pattern)
  return pattern
}

const templateSpans = (token: string): ReadonlyArray<Span> =>
  token
    .split(EXPRESSION)
    .filter((part) => part !== '')
    .map((part) => ({
      kind: part.startsWith('${') ? 'code' : 'string',
      text: part,
    }))

const isComment = (token: string, language: Language) =>
  token.startsWith(language.lineComment) ||
  (language.blockComment !== undefined &&
    token.startsWith(language.blockComment[0]))

const spansOf = (token: string, language: Language): ReadonlyArray<Span> => {
  if (isComment(token, language)) return [{ kind: 'comment', text: token }]
  if (token.startsWith('`')) return templateSpans(token)
  if (/^["']|^\/.+\/[a-z]*$/.test(token)) {
    return [{ kind: 'string', text: token }]
  }
  return [{ kind: 'code', text: token }]
}

const endsUnescaped = (token: string, close: string) =>
  token.endsWith(close) &&
  !/(?:^|[^\\])(?:\\\\)*\\$/.test(token.slice(0, -close.length))

const leftOpen = (token: string, language: Language): Open => {
  const { blockComment } = language
  if (
    blockComment !== undefined &&
    token.startsWith(blockComment[0]) &&
    !(
      token.length >= blockComment[0].length + blockComment[1].length &&
      token.endsWith(blockComment[1])
    )
  ) {
    return 'comment'
  }
  if (
    token.startsWith('`') &&
    !(token.length > 1 && endsUnescaped(token, '`'))
  ) {
    return 'template'
  }
  return undefined
}

const merged = (spans: ReadonlyArray<Span>) =>
  spans.reduce<Span[]>((joined, span) => {
    const last = joined.at(-1)
    return last?.kind === span.kind
      ? [
          ...joined.slice(0, -1),
          { kind: span.kind, text: last.text + span.text },
        ]
      : [...joined, span]
  }, [])

const continuation = (
  text: string,
  language: Language,
  open: Open,
): { readonly spans: ReadonlyArray<Span>; readonly open: Open } => {
  if (open === 'comment') {
    const close = language.blockComment?.[1] ?? ''
    const at = text.indexOf(close)
    const head = at === -1 ? text : text.slice(0, at + close.length)
    return {
      spans: head === '' ? [] : [{ kind: 'comment', text: head }],
      open: at === -1 ? 'comment' : undefined,
    }
  }
  if (open === 'template') {
    const head = TEMPLATE_CONTINUATION.exec(text)?.[0] ?? ''
    return {
      spans: templateSpans(head),
      open: endsUnescaped(head, '`') ? undefined : 'template',
    }
  }
  return { spans: [], open: undefined }
}

export const tokenize = (
  text: string,
  language: Language,
  open: Open,
): Tokens => {
  const head = continuation(text, language, open)
  const consumed = head.spans.reduce(
    (length, span) => length + span.text.length,
    0,
  )
  if (head.open !== undefined)
    return { spans: merged(head.spans), open: head.open }
  const tokens = [...text.slice(consumed).matchAll(tokenPattern(language))].map(
    ([token]) => token,
  )
  return {
    spans: merged([
      ...head.spans,
      ...tokens.flatMap((token) => spansOf(token, language)),
    ]),
    open:
      tokens.length === 0 ? undefined : leftOpen(tokens.at(-1) ?? '', language),
  }
}

export const only = (
  spans: ReadonlyArray<Span>,
  keep: (kind: Kind) => boolean,
) =>
  spans
    .map((span) => (keep(span.kind) ? span.text : ' '.repeat(span.text.length)))
    .join('')
