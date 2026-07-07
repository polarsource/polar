import { getMetricGroupSlug } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'

export type InsightAction = NonNullable<schemas['Insight']['primary_action']>

/**
 * Resolve an insight action to its dashboard destination.
 *
 * Actions arrive as a discriminated union on `type`: the backend names the
 * domain object the action concerns (a metric slug, a product id) and the
 * client owns all routing. Supporting a new action type is adding one case
 * here — the exhaustive switch makes a missed one a type error.
 */
export const resolveInsightActionHref = (
  organization: schemas['Organization'],
  action: InsightAction,
): string => {
  const dashboard = `/dashboard/${organization.slug}`
  switch (action.type) {
    case 'view_metric': {
      // The metrics dashboard is grouped by category, so an individual metric
      // links to its group's page; unknown slugs fall back to the index.
      const group = getMetricGroupSlug(action.metric)
      return group
        ? `${dashboard}/analytics/metrics/${group}`
        : `${dashboard}/analytics/metrics`
    }
    case 'adjust_price':
      return `${dashboard}/products/${action.product_id}`
    case 'add_currency':
      // Pricing is edited per product; the products list is the entry point
      // for adding a currency across the catalog.
      return `${dashboard}/products`
  }
}
