export interface ChartBar {
  label: string
  value: number
  delta?: string
}

export interface ArticleSection {
  id: string
  title: string
  paragraphs: string[]
  chart?: ChartBar[]
}

export interface Article {
  slug: string
  title: string
  dek: string
  category: string
  author: string
  date: string
  readingTime: string
  sections: ArticleSection[]
}

// Mocked editorial entries. Stands in for a real pricing journal.
export const articles: Article[] = [
  {
    slug: 'case-for-usage-based',
    title: 'The case for usage-based pricing',
    dek: 'Why metered pricing is winning the intelligence era, and where it still breaks down.',
    category: 'Strategy',
    author: 'Polar Research',
    date: '2026-06-20',
    readingTime: '6 min',
    sections: [
      {
        id: 'align-with-value',
        title: 'Align price with value',
        paragraphs: [
          'Seat pricing assumes value scales with the number of people in a tool. For most AI products it does not. Value scales with consumption, and consumption is wildly uneven across customers.',
          'When you charge for the unit that creates value, the bill tracks the outcome. Light users pay little and stay. Heavy users pay more and rarely churn, because the spend is already justified by what they got.',
        ],
        chart: [
          { label: 'Per-seat', value: 71, delta: '-6pts' },
          { label: 'Usage-based', value: 62, delta: '+14pts' },
          { label: 'Hybrid', value: 48, delta: '+9pts' },
          { label: 'Flat', value: 33, delta: '-4pts' },
          { label: 'Outcome-based', value: 12, delta: '+5pts' },
        ],
      },
      {
        id: 'where-it-breaks',
        title: 'Where it breaks',
        paragraphs: [
          'Pure usage pricing punishes exploration. Buyers fear an unpredictable invoice, and procurement cannot sign off on a number it cannot forecast. That fear, not the model, is what kills deals.',
        ],
      },
      {
        id: 'wrapping-the-meter',
        title: 'Wrapping the meter',
        paragraphs: [
          'The fix is rarely to abandon usage. It is to wrap it: prepaid credits to smooth spikes, committed minimums for predictability, and a generous free tier so the first taste costs nothing.',
        ],
      },
    ],
  },
  {
    slug: 'anthropic-teardown',
    title: 'Pricing teardown: Anthropic',
    dek: 'Three products, three models, one coherent ladder from API to enterprise.',
    category: 'Teardown',
    author: 'Polar Research',
    date: '2026-06-12',
    readingTime: '5 min',
    sections: [
      {
        id: 'the-ladder',
        title: 'The ladder',
        paragraphs: [
          'Anthropic runs three pricing models at once, and they do not conflict. Each one meets a different buyer where they are.',
          'Claude API is pure usage, for developers who want to pay for exactly what they call. Claude Pro is a flat monthly subscription, for individuals who want a predictable bill. Claude Team is per seat, for companies who buy by headcount.',
        ],
      },
      {
        id: 'the-takeaway',
        title: 'The takeaway',
        paragraphs: [
          'The lesson is not that you need three plans. It is that a single product can be priced three ways for three audiences, as long as each model maps cleanly to how that audience perceives value.',
        ],
      },
    ],
  },
  {
    slug: 'stop-pricing-per-seat',
    title: 'Stop pricing per seat',
    dek: 'The seat is a proxy that is quietly losing its meaning.',
    category: 'Opinion',
    author: 'Polar Research',
    date: '2026-05-30',
    readingTime: '4 min',
    sections: [
      {
        id: 'the-proxy',
        title: 'The seat as proxy',
        paragraphs: [
          'A seat used to be a clean proxy for value: more users, more work, more worth. Agents broke that. One person can now drive the workload of a team, and your seat count no longer reflects the value delivered.',
        ],
      },
      {
        id: 'price-the-work',
        title: 'Price the work, not the worker',
        paragraphs: [
          'If a single user can ten times their output overnight, a flat seat leaves most of that value on the table. Meter the work itself, and your revenue grows with the customer instead of lagging behind them.',
        ],
      },
    ],
  },
  {
    slug: 'what-a-price-change-signals',
    title: 'What a price change signals',
    dek: 'Every pricing update is a message to the market. Learn to read them.',
    category: 'Field note',
    author: 'Polar Research',
    date: '2026-05-18',
    readingTime: '7 min',
    sections: [
      {
        id: 'reading-the-moves',
        title: 'Reading the moves',
        paragraphs: [
          'When a company changes its prices, it is telling you something about its costs, its confidence, and its strategy. The directory tracks these moves so you can read the subtext.',
        ],
      },
      {
        id: 'cuts',
        title: 'Cuts are rarely generosity',
        paragraphs: [
          'A price cut usually means the cost to serve fell, or a competitor forced the issue. Either way it resets the anchor for the whole category, and your buyers will expect you to follow.',
        ],
      },
      {
        id: 'increases',
        title: 'Increases buy permission',
        paragraphs: [
          'A confident raise signals durable demand and a product that has earned it. Watch who raises first: they are betting the market will absorb it, and they are usually right.',
        ],
      },
    ],
  },
]

export const getArticleBySlug = (slug: string): Article | undefined =>
  articles.find((article) => article.slug === slug)
