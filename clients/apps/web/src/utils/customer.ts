/** A minimum, not a fallback: `first_user_event_at` can fall either side of `created_at`. */
export const getCustomerActivityStart = (customer: {
  created_at: string
  first_user_event_at?: string | null
}): Date => {
  const createdAt = new Date(customer.created_at)
  if (!customer.first_user_event_at) {
    return createdAt
  }
  const firstUserEventAt = new Date(customer.first_user_event_at)
  return firstUserEventAt < createdAt ? firstUserEventAt : createdAt
}

export const buildCustomerDashboardPath = (
  organizationSlug: string,
  customer: { id: string; email?: string | null; name?: string | null },
): string => {
  const search = customer.email ?? customer.name
  const params = search ? `?${new URLSearchParams({ query: search })}` : ''
  return `/dashboard/${organizationSlug}/customers/${customer.id}${params}`
}
