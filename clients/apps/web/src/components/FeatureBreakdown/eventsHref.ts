// A link into the event explorer with its filters set, over the same period
// as the feature view.
export const eventsHref = (
  organizationSlug: string,
  period: { start_date: string; end_date: string },
  filters: {
    eventTypes?: string[]
    event?: string
  },
) => {
  const params = new URLSearchParams({
    startDate: new Date(period.start_date).toISOString(),
    endDate: new Date(`${period.end_date}T23:59:59.999Z`).toISOString(),
  })
  if (filters.eventTypes?.length) {
    params.set('eventTypes', filters.eventTypes.join(','))
  }
  if (filters.event) params.set('event', filters.event)
  return `/dashboard/${organizationSlug}/analytics/events?${params}`
}
