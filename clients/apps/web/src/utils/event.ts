export const buildEventDashboardPath = (
  organizationSlug: string,
  eventId: string,
): string =>
  `/dashboard/${organizationSlug}/analytics/events?${new URLSearchParams({ event: eventId })}`

export const buildCustomerEventsPath = (
  organizationSlug: string,
  customerId: string,
): string =>
  `/dashboard/${organizationSlug}/analytics/events?${new URLSearchParams({ customerIds: customerId, range: 'allTime' })}`

const COST_EVENTS_FILTER = {
  conjunction: 'or',
  clauses: [
    { property: '_cost.amount', operator: 'gte', value: 0 },
    { property: '_cost.amount', operator: 'lt', value: 0 },
  ],
}

const LLM_EVENTS_FILTER = {
  conjunction: 'and',
  clauses: [{ property: '_llm.input_tokens', operator: 'gte', value: 0 }],
}

export const buildEventsFilter = ({
  costOnly,
  llmOnly,
}: {
  costOnly: boolean
  llmOnly: boolean
}) => {
  const filters = [
    ...(costOnly ? [COST_EVENTS_FILTER] : []),
    ...(llmOnly ? [LLM_EVENTS_FILTER] : []),
  ]
  return filters.length > 0
    ? JSON.stringify({ conjunction: 'and', clauses: filters })
    : null
}

export const formatEventCount = (count: number) =>
  new Intl.NumberFormat('en-US', {
    notation: count < 100_000 ? 'standard' : 'compact',
    maximumFractionDigits: 1,
  }).format(count)
