/**
 * The manual as chapters: a number, a name for the row at the top, a title, a paragraph, and the plates it shows.
 * Read in order, or jumped to by number.
 */
export interface Chapter {
  /** The chapter's number, or empty for the cover, which is not numbered. */
  n: string
  name: string
  title: string
  intro?: string
  ids: string[]
}

export const CHAPTERS: Chapter[] = [
  {
    n: '',
    name: 'Home',
    title: 'Agent-first Billing: A Field Guide',
    ids: ['cover'],
  },
  {
    n: '00',
    name: 'Principles',
    title: 'Core principles',
    intro:
      'Three ideas run through everything that follows. Every number comes from events, agents are customers like any other, and billing answers next to your code without waiting on Polar.',
    ids: ['m-principle', 'm-agents'],
  },
  {
    n: '01',
    name: 'Billing as code',
    title: 'Billing as code',
    intro:
      'The catalogue is a file. Products, prices, meters and entitlements are declared once, reviewed as a diff, and applied to an environment, so a pricing change goes through the same review as any other code.',
    ids: ['m-code', 'm-cli', 'm-check'],
  },
  {
    n: '02',
    name: 'Events',
    title: 'Events',
    intro:
      'An event is a fact: at this time, this customer, through this actor, did this thing, this much. The event log only grows, and every usage number is derived from it.',
    ids: ['m-event', 'm-ledger', 'm-ingest'],
  },
  {
    n: '03',
    name: 'Meters',
    title: 'Meters',
    intro:
      'A meter turns events into a number: which events count, and how to add them up. Polar keeps that number current as events arrive, and can always rebuild it from the events behind it.',
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
    name: 'Guardrails',
    title: 'Guardrails',
    intro:
      'A guardrail is a condition on a number Polar already keeps: a meter, a credit balance, a margin. When the number crosses it, a signal fires and runs your side effect, so you can move a customer to a cheaper model before the credits run out.',
    ids: ['m-signals', 'm-margin'],
  },
  {
    n: '06',
    name: 'Credits',
    title: 'Credits',
    intro:
      'Credits are a balance derived from two kinds of event: grants, which add, and usage, which takes away at the meter’s rate. Run out, and Polar keeps counting: what happens at zero is up to your app.',
    ids: ['m-credits', 'm-grants', 'm-zero'],
  },
  {
    n: '07',
    name: 'Entitlements',
    title: 'Entitlements',
    intro:
      'Access is one state line from the subscription, and it drives every switch. From checkout to access there is one path, and entitlements are what it switches on.',
    ids: ['m-gates', 'm-flow', 'm-entitlements'],
  },
  {
    n: '08',
    name: 'Agents',
    title: 'Agents',
    intro:
      'Customers, agents and actors nest. A key names an actor, a session names a run, and every event carries who did it. An agent is a customer that can ask.',
    ids: ['m-nesting', 'm-ask'],
  },
]

/** The chapter a page is in. */
export const chapterOf = (id: string) =>
  Math.max(
    0,
    CHAPTERS.findIndex((c) => c.ids.includes(id)),
  )

/** What a chapter is found by on the page: its number, or `home` for the unnumbered cover. */
export const chapterKey = (c: Chapter) => c.n || 'home'
