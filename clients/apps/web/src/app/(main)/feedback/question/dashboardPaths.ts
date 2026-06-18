// Allowed dashboard paths for assistant deep-links. Each entry is appended to
// `https://polar.sh/to/dashboard/` — the redirector resolves the active
// organization slug at request time, so we never need to embed it.
//
// Only overview / non-detail paths are allowed (no `:id`-bearing routes).
// To regenerate after adding/removing dashboard pages, run from
// `clients/apps/web` and update the array below:
//
//   find 'src/app/(main)/dashboard/[organization]' -name page.tsx \
//     | sed 's|^src/app/(main)/dashboard/\[organization\]||;s|/page\.tsx$||;s|/(home)$||;s|/([^/]*)|/|g;s|//|/|g;s|/$||' \
//     | grep -v '/\[' | sort -u

export const ALLOWED_DASHBOARD_PATHS = [
  '', // dashboard home
  'analytics',
  'analytics/costs',
  'analytics/events',
  'analytics/metrics',
  'customers',
  'finance/account',
  'finance/income',
  'finance/payouts',
  'onboarding/integrate',
  'products',
  'products/benefits',
  'products/checkout-links',
  'products/discounts',
  'products/meters',
  'products/meters/create',
  'products/new',
  'products/new/ai',
  'sales',
  'sales/checkouts',
  'sales/subscriptions',
  'settings',
  'settings/billing',
  'settings/billing/change-plan',
  'settings/custom-fields',
  'settings/members',
  'settings/webhooks',
] as const
