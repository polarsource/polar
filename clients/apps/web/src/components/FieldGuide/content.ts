/**
 * The manual as chapters: a number, a name for the row at the top, a title, a paragraph, a tip, the control the
 * chapter puts on the page, and the plates it shows. Read in order, or jumped to by number.
 */
export type Control = 'traffic' | 'rate' | 'grant'

export interface Chapter {
  n: string
  name: string
  title: string
  intro?: string
  /** `[before, key, after]`, set with a key cap. */
  tip?: [string, string, string]
  control?: Control
  ids: string[]
}

export const CHAPTERS: Chapter[] = [
  {
    n: '00',
    name: 'Home',
    title: 'Billing for the Intelligence Era.',
    ids: ['cover', 'm-principle'],
  },
  {
    n: '01',
    name: 'Billing as code',
    title: 'Billing as code',
    intro:
      'The catalogue is a file. Products, prices, meters and benefits are declared once, reviewed as a diff, and applied to an environment. What runs in production is what was reviewed.',
    tip: [
      'Press',
      'E',
      'to emit an event and watch the figures in every chapter change.',
    ],
    ids: ['m-code', 'm-cli', 'm-env'],
  },
  {
    n: '02',
    name: 'Events',
    title: 'Events',
    intro:
      'An event is a fact: at this time, this customer, through this actor, did this thing, this much. The ledger only grows, and everything else is derived from it.',
    tip: ['Press', 'T', 'to change how fast events arrive.'],
    control: 'traffic',
    ids: ['m-event', 'm-ledger', 'm-ingest', 'm-replay'],
  },
  {
    n: '03',
    name: 'Meters',
    title: 'Meters',
    intro:
      'A meter does not count; it folds. Given the state so far and the next event, it returns the next state. Nothing is stored that cannot be recomputed, so nothing can drift.',
    tip: [
      'Change the rate below, then press',
      '5',
      'to read the invoice again.',
    ],
    control: 'rate',
    ids: ['m-meter', 'm-latency', 'm-tiers', 'm-reconcile'],
  },
  {
    n: '04',
    name: 'Credits',
    title: 'Credits',
    intro:
      'Credits are a balance derived from two kinds of event: grants, which add, and usage, which takes away at the meter’s rate. When the balance would cross zero, a grant lands first.',
    tip: ['Press', 'R', 'to start the ledger again from an empty balance.'],
    control: 'grant',
    ids: ['m-credits', 'm-grants', 'm-zero'],
  },
  {
    n: '05',
    name: 'Invoices',
    title: 'Invoices',
    intro:
      'An invoice is not typed; it is computed. Each line is a meter read at the end of the period, multiplied by its rate. Credits come off before the sum.',
    ids: ['m-invoice', 'm-usage', 'm-proration'],
  },
  {
    n: '06',
    name: 'Entitlements',
    title: 'Entitlements',
    intro:
      'Access is one state line from the subscription, and it drives every switch. From checkout to access there is one path; benefits are what it switches on.',
    ids: ['m-gates', 'm-flow', 'm-benefits'],
  },
  {
    n: '07',
    name: 'Agents',
    title: 'Agents',
    intro:
      'Customers, agents and actors nest. A key names an actor, a session names a run, and every event carries who did it. An agent is a customer that can ask.',
    ids: ['m-nesting', 'm-keys', 'm-ask'],
  },
  {
    n: '08',
    name: 'Appendix',
    title: 'Appendix',
    intro: 'The event catalogue, the API in one call, and the glossary.',
    ids: ['m-catalogue', 'm-api', 'm-glossary'],
  },
]

/** The chapter a page is in. */
export const chapterOf = (id: string) =>
  Math.max(
    0,
    CHAPTERS.findIndex((c) => c.ids.includes(id)),
  )
