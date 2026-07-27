export const buildCustomerDashboardPath = (
  organizationSlug: string,
  customer: { id: string; email?: string | null; name?: string | null },
): string => {
  const search = customer.email ?? customer.name
  const params = search ? `?${new URLSearchParams({ query: search })}` : ''
  return `/dashboard/${organizationSlug}/customers/${customer.id}${params}`
}
