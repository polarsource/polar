import {
  BillingOwner,
  IssueCode,
  MockSubscriptionRecord,
  mockSubscriptions,
  SubscriptionCategory,
} from './mockData'

export interface MigrationTotals {
  total: number
  clean: number
  problems: number
  canarySelectable: number
  stripeOwned: number
  polarOwned: number
  unknownOwned: number
}

export type ProblemCategoryTotals = Record<
  Exclude<SubscriptionCategory, 'clean'>,
  number
>

export interface TransferReceipt {
  moved: number
  remainingProblems: number
  stripeOwned: number
  polarOwned: number
  unknownOwned: number
  movedIds: string[]
  stripeOwnedIds: string[]
}

export interface RepresentativeSubscription {
  id: string
  customerLabel: string
  customerEmail: string | null
  planLabel: string
  category: SubscriptionCategory
  status: MockSubscriptionRecord['status']
  issueCode: IssueCode
  title: string
  canarySelectable: boolean
  billingOwner: BillingOwner
}

const PROBLEM_CATEGORIES: Exclude<SubscriptionCategory, 'clean'>[] = [
  'customer',
  'identity',
  'product',
  'payment',
  'lifecycle',
  'pricing',
  'cutover',
]

const PREFERRED_PROBLEM_CODES: IssueCode[] = [
  'customer_missing_country',
  'customer_stripe_id_conflict',
  'missing_payment_method',
  'renewal_inside_safety_window',
  'customer_already_subscribed',
]

const isClean = (record: MockSubscriptionRecord): boolean =>
  record.category === 'clean' && record.canarySelectable

const partition = (records: MockSubscriptionRecord[]) => {
  const clean: MockSubscriptionRecord[] = []
  const problems: MockSubscriptionRecord[] = []
  for (const record of records) {
    if (isClean(record)) {
      clean.push(record)
    } else if (record.category !== 'clean') {
      problems.push(record)
    }
  }
  return { clean, problems }
}

const defaultPartition = partition(mockSubscriptions)
const problemsByCode = new Map(
  defaultPartition.problems.map((record) => [record.issueCode, record]),
)

export function resolveBillingOwner(
  record: MockSubscriptionRecord,
  transferred: boolean,
): BillingOwner {
  if (!transferred) {
    return record.billingOwner
  }
  return record.canarySelectable ? 'polar' : 'stripe'
}

export function getCleanSubscriptions(
  records: MockSubscriptionRecord[] = mockSubscriptions,
): MockSubscriptionRecord[] {
  return records === mockSubscriptions
    ? defaultPartition.clean
    : partition(records).clean
}

export function getProblemSubscriptions(
  records: MockSubscriptionRecord[] = mockSubscriptions,
): MockSubscriptionRecord[] {
  return records === mockSubscriptions
    ? defaultPartition.problems
    : partition(records).problems
}

export function getInitialTotals(
  records: MockSubscriptionRecord[] = mockSubscriptions,
): MigrationTotals {
  let clean = 0
  let problems = 0
  let canarySelectable = 0
  let stripeOwned = 0
  let polarOwned = 0
  let unknownOwned = 0

  for (const record of records) {
    if (record.category === 'clean') {
      clean += 1
    } else {
      problems += 1
    }
    if (record.canarySelectable) {
      canarySelectable += 1
    }
    if (record.billingOwner === 'stripe') {
      stripeOwned += 1
    } else if (record.billingOwner === 'polar') {
      polarOwned += 1
    } else {
      unknownOwned += 1
    }
  }

  return {
    total: records.length,
    clean,
    problems,
    canarySelectable,
    stripeOwned,
    polarOwned,
    unknownOwned,
  }
}

export function getProblemCategoryTotals(
  records: MockSubscriptionRecord[] = mockSubscriptions,
): ProblemCategoryTotals {
  const totals = Object.fromEntries(
    PROBLEM_CATEGORIES.map((category) => [category, 0]),
  ) as ProblemCategoryTotals

  for (const record of getProblemSubscriptions(records)) {
    if (record.category !== 'clean') {
      totals[record.category] += 1
    }
  }

  return totals
}

export function getIssueCodes(
  records: MockSubscriptionRecord[] = mockSubscriptions,
): IssueCode[] {
  return [
    ...new Set(
      getProblemSubscriptions(records).map((record) => record.issueCode),
    ),
  ].sort()
}

export function buildTransferReceipt(
  records: MockSubscriptionRecord[] = mockSubscriptions,
): TransferReceipt {
  const { clean, problems } =
    records === mockSubscriptions ? defaultPartition : partition(records)

  return {
    moved: clean.length,
    remainingProblems: problems.length,
    polarOwned: clean.length,
    stripeOwned: problems.length,
    unknownOwned: 0,
    movedIds: clean.map((record) => record.id),
    stripeOwnedIds: problems.map((record) => record.id),
  }
}

export function getOwnershipForTransfer(
  transferred: boolean,
  records: MockSubscriptionRecord[] = mockSubscriptions,
): Pick<MigrationTotals, 'stripeOwned' | 'polarOwned' | 'unknownOwned'> {
  if (!transferred) {
    return {
      stripeOwned: records.length,
      polarOwned: 0,
      unknownOwned: 0,
    }
  }

  const receipt = buildTransferReceipt(records)
  return {
    stripeOwned: receipt.stripeOwned,
    polarOwned: receipt.polarOwned,
    unknownOwned: receipt.unknownOwned,
  }
}

export function getRepresentativeSubscriptions(
  records: MockSubscriptionRecord[] = mockSubscriptions,
): RepresentativeSubscription[] {
  const clean = getCleanSubscriptions(records).slice(0, 3)
  const lookup =
    records === mockSubscriptions
      ? problemsByCode
      : new Map(
          getProblemSubscriptions(records).map((record) => [
            record.issueCode,
            record,
          ]),
        )
  const problems = PREFERRED_PROBLEM_CODES.flatMap((code) => {
    const record = lookup.get(code)
    return record ? [record] : []
  })

  return [...clean, ...problems].map((record) => ({
    id: record.id,
    customerLabel: record.customerLabel,
    customerEmail: record.customerEmail,
    planLabel: record.planLabel,
    category: record.category,
    status: record.status,
    issueCode: record.issueCode,
    title: record.title,
    canarySelectable: record.canarySelectable,
    billingOwner: record.billingOwner,
  }))
}
