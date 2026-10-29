export const buildEventDashboardPath = (
  organizationSlug: string,
  eventId: string,
): string =>
  `/dashboard/${organizationSlug}/analytics/events?${new URLSearchParams({ event: eventId })}`

export const COST_EVENTS_FILTER = JSON.stringify({
  conjunction: 'or',
  clauses: [
    { property: '_cost.amount', operator: 'gte', value: 0 },
    { property: '_cost.amount', operator: 'lt', value: 0 },
  ],
})
