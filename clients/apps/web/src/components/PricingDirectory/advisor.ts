import { Company, PricingModel } from './types'

export interface Choice {
  value: string
  label: string
  hint?: string
}

export interface AdvisorQuestion {
  id: string
  prompt: string
  type: 'text' | 'choice'
  placeholder?: string
  choices?: Choice[]
}

export const questions: AdvisorQuestion[] = [
  {
    id: 'product',
    type: 'text',
    prompt: 'What are you building?',
    placeholder: 'e.g. An AI coding agent',
  },
  {
    id: 'audience',
    type: 'choice',
    prompt: 'Who is it for?',
    choices: [
      { value: 'developers', label: 'Developers' },
      { value: 'startups', label: 'Startups' },
      { value: 'enterprises', label: 'Enterprises' },
      { value: 'consumers', label: 'Consumers' },
    ],
  },
  {
    id: 'value',
    type: 'choice',
    prompt: 'How do customers get value?',
    choices: [
      { value: 'seat', label: 'Per person', hint: 'More users, more value' },
      { value: 'usage', label: 'Per usage', hint: 'Value scales with consumption' },
      { value: 'outcome', label: 'Per outcome', hint: 'Value is tied to results' },
      { value: 'flat', label: 'Flat access', hint: 'Value is access itself' },
    ],
  },
  {
    id: 'usage',
    type: 'choice',
    prompt: 'How predictable is their consumption?',
    choices: [
      { value: 'steady', label: 'Steady' },
      { value: 'spiky', label: 'Spiky' },
      { value: 'unknown', label: 'Hard to predict' },
    ],
  },
  {
    id: 'goal',
    type: 'choice',
    prompt: 'What matters most right now?',
    choices: [
      { value: 'adoption', label: 'Adoption' },
      { value: 'revenue', label: 'Revenue per account' },
      { value: 'predictability', label: 'Predictable revenue' },
    ],
  },
]

export type Answers = Record<string, string>

export interface Comparable {
  slug: string
  name: string
  product: string
  anchor: string
}

export interface Recommendation {
  model: string
  rationale: string
  mechanics: string[]
  comparables: Comparable[]
}

const modelToEntryModel: Record<string, PricingModel> = {
  'Usage-based': 'Usage',
  'Usage-based with prepaid credits': 'Usage',
  'Per-seat': 'Seat',
  'Outcome-based': 'Hybrid',
  'Flat subscription': 'Tiered',
}

export function recommend(
  answers: Answers,
  companies: Company[],
): Recommendation {
  let model = 'Flat subscription'
  if (answers.value === 'usage') model = 'Usage-based'
  else if (answers.value === 'seat') model = 'Per-seat'
  else if (answers.value === 'outcome') model = 'Outcome-based'

  const mechanics: string[] = []

  if (model === 'Usage-based') {
    if (answers.usage === 'spiky' || answers.usage === 'unknown') {
      model = 'Usage-based with prepaid credits'
      mechanics.push('Sell prepaid credit packs to smooth out spiky bills.')
    }
    mechanics.push('Meter the one unit that maps to value (tokens, runs, GB).')
  }
  if (model === 'Per-seat') {
    mechanics.push('Charge per active seat, with volume discounts at scale.')
  }
  if (model === 'Outcome-based') {
    mechanics.push('Anchor price to a measurable result the customer cares about.')
  }
  if (answers.goal === 'predictability') {
    mechanics.push('Add committed minimums or annual plans for predictable revenue.')
  }
  if (answers.goal === 'adoption') {
    mechanics.push('Lead with a generous free tier to pull in new users.')
  }
  if (answers.goal === 'revenue') {
    mechanics.push('Layer premium tiers and add-ons to grow revenue per account.')
  }
  if (answers.audience === 'enterprises') {
    mechanics.push('Offer a custom enterprise plan with SSO, SLAs, and invoicing.')
  }

  const target = modelToEntryModel[model]
  const comparables = companies
    .flatMap((company) =>
      company.products
        .filter((product) => product.model === target)
        .map((product) => ({
          slug: company.slug,
          name: company.name,
          product: product.name,
          anchor: product.anchor,
        })),
    )
    .slice(0, 3)

  const rationale = `For ${answers.audience ?? 'your audience'}, a ${model.toLowerCase()} approach keeps what you charge in step with the value customers actually receive.`

  return { model, rationale, mechanics, comparables }
}
