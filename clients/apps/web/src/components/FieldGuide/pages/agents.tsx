import { term, type TermTok } from '../kit'
import { landscape } from './more'

/**
 * The vision, before the machinery: an agent running pricing through Polar's MCP server. One session, set as a
 * transcript: what the agent noticed, the calls it made, the change it drafted, and the check that change passed.
 */

const D = (t: string): TermTok => ({ t, tone: 'dim' })
const call = (tool: string, subject: string, value: TermTok[]): TermTok[] => [
  D('mcp  '),
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
  call('usage', 'tokens.out', [{ t: '+38%' }, D('  this week')]),
  call('propose', 'price · pro', [{ t: '$2.00 → $2.40 / M', tone: 'add' }]),
  call('check', 'margin · pro', [{ t: '27%' }, D('   pass')]),
  [],
  [{ t: 'approve', tone: 'inv' }, D('  or ask for another plan')],
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
  'Run by agents',
  'Agents that watch your margins, draft a new price and ship it, through Polar’s MCP.',
  'An agent session over Polar’s MCP server: it sees margin on a plan fall below the floor, reads usage, drafts a higher price, checks the new margin, and waits for approval.',
  figure,
  [
    [
      'Billing an agent can use',
      [
        'Every part of Polar is reachable through its MCP server: products, prices, meters, customers, usage, and the numbers derived from them. An agent works with the same billing you do.',
      ],
    ],
    [
      'Watch, draft, check',
      [
        'An agent can watch margin and usage, notice when a model gets more expensive, and draft a new price. The draft runs the same margin check as a pull request.',
      ],
    ],
    [
      'You set the limits',
      [
        'Nothing ships past your guardrails. The agent proposes and the checks run; you approve, or let it apply changes within limits you choose.',
      ],
    ],
    [
      'Beyond pricing',
      [
        'The same loop runs RevOps: spotting customers near their limits, offering upgrades, chasing failed payments, granting credits when something goes wrong.',
      ],
    ],
  ],
)
