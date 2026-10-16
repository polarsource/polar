import jsTokens, { type Token } from 'js-tokens'

export type Kind = 'code' | 'string' | 'comment'

export interface Span {
  readonly kind: Kind
  readonly text: string
}

export type Lines = ReadonlyArray<ReadonlyArray<Span>>

const KINDS: Readonly<Record<Token['type'], Kind>> = {
  StringLiteral: 'string',
  NoSubstitutionTemplate: 'string',
  TemplateHead: 'string',
  TemplateMiddle: 'string',
  TemplateTail: 'string',
  RegularExpressionLiteral: 'string',
  MultiLineComment: 'comment',
  SingleLineComment: 'comment',
  HashbangComment: 'comment',
  IdentifierName: 'code',
  PrivateIdentifier: 'code',
  NumericLiteral: 'code',
  Punctuator: 'code',
  WhiteSpace: 'code',
  LineTerminatorSequence: 'code',
  Invalid: 'code',
}

const append = (line: Span[], span: Span) => {
  const last = line.at(-1)
  if (last?.kind === span.kind) {
    line[line.length - 1] = { kind: span.kind, text: last.text + span.text }
  } else {
    line.push(span)
  }
}

export const tokenizeJavaScript = (source: string): Lines => {
  const lines: Span[][] = [[]]
  for (const token of jsTokens(source)) {
    const kind = KINDS[token.type]
    token.value.split('\n').forEach((text, index) => {
      if (index > 0) lines.push([])
      if (text !== '') append(lines[lines.length - 1]!, { kind, text })
    })
  }
  return lines
}

const FILLER = '·'

export const only = (
  spans: ReadonlyArray<Span>,
  keep: (kind: Kind) => boolean,
) =>
  spans
    .map((span) =>
      keep(span.kind) ? span.text : FILLER.repeat(span.text.length),
    )
    .join('')
