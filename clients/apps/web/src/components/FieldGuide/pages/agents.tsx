import { term, type TermTok } from '../kit'
import { landscape } from './more'

/**
 * Agentic workflows, before the machinery: an agent you already use, working with billing through Polar's MCP server.
 * One session, set as a transcript: what it noticed, the calls it made, the draft it left, and the person who approved.
 */

/** The width of the first column, in characters: who or what each row is. */
const LEAD = 7

const D = (t: string): TermTok => ({ t, tone: 'dim' })
const call = (tool: string, subject: string, value: TermTok[]): TermTok[] => [
  D('mcp'.padEnd(LEAD)),
  { t: tool, w: 10 },
  D(subject.padEnd(16)),
  ...value,
]

const SESSION: TermTok[][] = [
  [
    { t: 'agent', tone: 'inv' },
    { t: '  Margin on pro fell to 12% this week. Opus got pricier.' },
  ],
  [],
  call('metrics', 'margin · pro', [
    { t: '12%', tone: 'del' },
    D('   floor 20%'),
  ]),
  call('usage', 'output tokens', [{ t: '+38%' }, D('  this week')]),
  call('draft', 'price · pro', [{ t: '$2.00 → $2.40 / M', tone: 'add' }]),
  call('check', 'margin · pro', [{ t: '27%' }, D('   pass')]),
  [],
  [
    { t: 'draft', tone: 'dim', w: LEAD },
    { t: 'pricing/opus-up', w: 26 },
    D('waiting for review'),
  ],
  [
    { t: 'you', tone: 'inv', w: LEAD },
    { t: 'approved', w: 26 },
    D('applied to prod'),
  ],
]

const figure = (() => {
  const { line } = term(60, 168, 7.5, 14)
  return (
    <>
      {SESSION.map((toks, i) =>
        toks.length ? line(i, 0, toks, `r${i}`) : null,
      )}
    </>
  )
})()

export const agentOps = landscape(
  'm-agents',
  'Native to agentic workflows',
  'Agents do the legwork, and people make the call.',
  'An agent session over Polar’s MCP server: it sees margin on a plan fall below the floor, reads usage, drafts a higher price that passes the margin check, and leaves it for a person, who approves it.',
  figure,
  [
    [
      'Agents as customers',
      [
        'Customers hold their agents, and every event says which one acted. Usage rolls up to whoever pays.',
      ],
    ],
    [
      'Agents draft changes',
      [
        'Agents in your editor, your chat or your own stack read usage and margins through Polar’s MCP server and draft changes. A draft is a branch, checked like any other change.',
      ],
    ],
    [
      'A person approves',
      [
        'Someone on your team reviews the draft and approves it, or asks for another. Nothing reaches customers on its own.',
      ],
    ],
  ],
)
