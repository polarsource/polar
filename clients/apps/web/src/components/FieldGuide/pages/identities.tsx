import { term, type TermTok } from '../kit'
import { landscape } from './more'

/**
 * Identities sharing and passing down credits: one company's pool, a slice of it handed to each identity beneath, and
 * a run at the bottom that has used all of its own.
 */

const D = (t: string): TermTok => ({ t, tone: 'dim' })
const TREE: TermTok[][] = [
  [D('IDENTITY                    CREDITS        USED')],
  [{ t: 'acme                ' }, D('pool    '), { t: ' 10,000       3,680' }],
  [
    D('├ '),
    { t: 'research          ' },
    D('limit   '),
    { t: '  4,000       2,180' },
  ],
  [
    D('│ └ '),
    { t: 'agent           ' },
    D('budget  '),
    { t: '    500         480' },
  ],
  [
    D('└ '),
    { t: 'support-bot       ' },
    D('limit   '),
    { t: '  3,000       1,500' },
  ],
  [
    D('  └ '),
    { t: 'run_7f2         ' },
    D('cap     '),
    { t: '     50          ' },
    { t: '50', tone: 'del' },
  ],
  [],
  [{ t: 'signal', tone: 'del' }, { t: '  run_7f2 used its cap' }],
  [D('        → your app decides what happens next')],
]

const figure = (() => {
  const { line } = term(70, 165, 7.5, 14)
  return (
    <>
      {TREE.map((toks, i) => (toks.length ? line(i, 0, toks, `r${i}`) : null))}
    </>
  )
})()

export const delegation = landscape(
  'm-delegate',
  'Shared and delegated',
  'Credits and limits flow down the tree the way you set them.',
  'One company’s pool of 10,000 credits, a limit handed to a team and to an agent, a budget and a cap further down, and a run that has used all of its cap.',
  figure,
  [
    [
      'Shared',
      [
        'A company buys one pool of credits, and every identity beneath it draws from the same pool.',
      ],
    ],
    [
      'Delegated',
      [
        'Hand a slice down: a team gets a limit, an agent a budget, a single run a cap of its own. Usage still adds up to the pool.',
      ],
    ],
    [
      'Same guardrails',
      [
        'Each level can carry its own signals, so you hear about one run burning through its cap long before the company’s pool feels it.',
      ],
    ],
  ],
)
