import type {
  IssueCode,
  MockSubscriptionRecord,
  PaymentReadiness,
  SubscriptionCategory,
  SubscriptionStatus,
} from './mockTypes'

const usdMonth = (
  amountCents: number,
): Pick<MockSubscriptionRecord, 'amountCents' | 'currency' | 'cadence'> => ({
  amountCents,
  currency: 'usd',
  cadence: 'month',
})

const moneyPlan = (productName: string, amountCents: number): string =>
  `${productName} · $${(amountCents / 100).toFixed(0)}/mo`

export const clean = (
  index: number,
  customerLabel: string,
  emailLocal: string,
  productName: string,
  amountCents: number,
): MockSubscriptionRecord => ({
  id: `sub_clean_${String(index).padStart(2, '0')}`,
  customerLabel,
  customerEmail: `${emailLocal}@example.com`,
  productName,
  planLabel: moneyPlan(productName, amountCents),
  ...usdMonth(amountCents),
  category: 'clean',
  status: 'ready',
  issueCode: 'none',
  title: 'Ready for canary transfer',
  detail:
    'Mapped product, matching card, billing country present, and renewal outside 24 hours.',
  recommendedAction: 'Include in the clean canary cohort.',
  billingOwner: 'stripe',
  paymentReadiness: 'matching',
  canarySelectable: true,
})

type ProblemSpec = {
  id: string
  customerLabel: string
  emailLocal: string | null
  productName: string
  amountCents: number
  planLabel?: string
  category: Exclude<SubscriptionCategory, 'clean'>
  status: Exclude<SubscriptionStatus, 'ready'>
  issueCode: Exclude<IssueCode, 'none'>
  title: string
  detail: string
  recommendedAction: string
  paymentReadiness?: PaymentReadiness
}

export const problem = (spec: ProblemSpec): MockSubscriptionRecord => ({
  id: spec.id,
  customerLabel: spec.customerLabel,
  customerEmail:
    spec.emailLocal === null ? null : `${spec.emailLocal}@example.com`,
  productName: spec.productName,
  planLabel: spec.planLabel ?? moneyPlan(spec.productName, spec.amountCents),
  ...usdMonth(spec.amountCents),
  category: spec.category,
  status: spec.status,
  issueCode: spec.issueCode,
  title: spec.title,
  detail: spec.detail,
  recommendedAction: spec.recommendedAction,
  billingOwner: 'stripe',
  paymentReadiness: spec.paymentReadiness ?? 'matching',
  canarySelectable: false,
})
