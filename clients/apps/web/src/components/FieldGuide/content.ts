/**
 * The manual as chapters: a number, a name for the row at the top, a title, a paragraph, and the plates it shows.
 * Read in order, or jumped to by number.
 */
export interface Chapter {
  n: string
  name: string
  title: string
  intro?: string
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
    ids: ['m-code', 'm-cli'],
  },
  {
    n: '02',
    name: 'Events',
    title: 'Events',
    intro:
      'An event is a fact: at this time, this customer, through this actor, did this thing, this much. The ledger only grows, and everything else is derived from it.',
    ids: ['m-event', 'm-ledger', 'm-ingest'],
  },
  {
    n: '03',
    name: 'Meters',
    title: 'Meters',
    intro:
      'A meter does not count; it folds. Given the state so far and the next event, it returns the next state. Nothing is stored that cannot be recomputed, so nothing can drift.',
    ids: ['m-meter', 'm-fold', 'm-tiers'],
  },
  {
    n: '04',
    name: 'Local-first',
    title: 'Local-first',
    intro:
      'Igloo runs inside your own process. It folds every event with the reducers Polar runs, in your own Redis, so a check is answered where your code is. Polar settles the usage behind it and sends that back.',
    ids: ['m-igloo', 'm-latency', 'm-reconcile'],
  },
  {
    n: '05',
    name: 'Credits',
    title: 'Credits',
    intro:
      'Credits are a balance derived from two kinds of event: grants, which add, and usage, which takes away at the meter’s rate. When the balance would cross zero, a grant lands first.',
    ids: ['m-credits', 'm-grants', 'm-zero'],
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
