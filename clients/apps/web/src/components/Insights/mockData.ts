import type { Insight } from './types'

/**
 * Mock insights for the AI-powered widget. The shape mirrors what the
 * server-side generator should eventually emit — keep this stable as the
 * real backend can drop in over the same Insight type.
 */
export const getMockInsights = (organizationSlug: string): Insight[] => [
  {
    id: 'revenue-mrr-week',
    category: 'revenue',
    categoryLabel: 'Revenue',
    title: 'MRR grew 12% this week',
    body: 'Three customers upgraded to annual plans. Net new MRR: $1,240.',
    primaryAction: {
      label: 'View breakdown',
      href: `/dashboard/${organizationSlug}/analytics/metrics?metric=mrr&range=7d`,
    },
  },
  {
    id: 'retention-starter-cancellations',
    category: 'retention',
    categoryLabel: 'Retention',
    title: 'Cancellations rose in your Starter plan',
    body:
      'Five of six cancellations this month were on the $20 tier, and three of those cited price at checkout. Estimated impact: −$340 MRR.',
    why:
      'Detected by comparing the cancellation rate on each active price against your 30-day baseline. Sample size is small (n=6) so confidence is moderate.',
    primaryAction: {
      label: 'See affected customers',
      href: `/dashboard/${organizationSlug}/customers?filter=churned&range=30d`,
    },
    rejectable: true,
  },
  {
    id: 'growth-trial-conversion',
    category: 'growth',
    categoryLabel: 'Growth',
    title: 'Trial → paid conversion hit an all-time high',
    body:
      '42% of last week’s trials converted, up from a 28% rolling average. The lift concentrates on the Pro tier.',
    why:
      'Comparing the 7-day rolling trial conversion against the 90-day rolling baseline, filtered to your most-active product cohort.',
    primaryAction: {
      label: 'Open conversion funnel',
      href: `/dashboard/${organizationSlug}/analytics/metrics?metric=trial_conversion&range=30d`,
    },
    rejectable: true,
  },
  {
    id: 'risk-failed-payments',
    category: 'risk',
    categoryLabel: 'Risk',
    title: 'Failed payments doubled in the last 7 days',
    body:
      '11 failed renewals this week vs. 5 the previous week. Two are over their grace window and at risk of involuntary churn.',
    why:
      'Triggered when failed-payment count exceeds 1.5× the prior-week count and the at-risk count rises by more than two.',
    primaryAction: {
      label: 'Review failed payments',
      href: `/dashboard/${organizationSlug}/sales/payments?status=failed&range=7d`,
    },
    rejectable: true,
  },
  {
    id: 'product-trial-product',
    category: 'product',
    categoryLabel: 'Product',
    title: 'Your most-viewed product had 3× the trial starts',
    body:
      'The new "Pro Plus" tier accounted for 38% of new trials this week despite being launched 9 days ago.',
    primaryAction: {
      label: 'Open product analytics',
      href: `/dashboard/${organizationSlug}/sales/products`,
    },
    rejectable: true,
  },
]
