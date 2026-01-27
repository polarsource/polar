import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

/**
 * Check if an authenticated user has billing permissions.
 *
 * Billing permissions are required for:
 * - Cancelling/updating subscriptions
 * - Managing payment methods
 * - Viewing orders/invoices
 *
 * @param authenticatedUser - The authenticated portal user (customer or member)
 * @returns true if the user has billing permissions
 */
export const hasBillingPermission = (
  authenticatedUser: schemas['PortalAuthenticatedUser'] | undefined,
): boolean => {
  // Unauthenticated users can't access billing
  if (!authenticatedUser) {
    return false
  }
  // Customers always have billing access (legacy behavior)
  if (authenticatedUser.type === 'customer') {
    return true
  }
  // Members need owner or billing_manager role
  return (
    authenticatedUser.role === 'owner' ||
    authenticatedUser.role === 'billing_manager'
  )
}

const _getOrganizationOrNotFound = async (
  api: Client,
  slug: string,
  searchParams?: Record<string, string>,
): Promise<schemas['CustomerOrganizationData']> => {
  return unwrap(
    api.GET('/v1/customer-portal/organizations/{slug}', {
      params: {
        path: {
          slug,
        },
      },
      next: {
        revalidate: 600,
        tags: [`organizations:${slug}`],
      },
    }),
    {
      404: notFound,
      429: () => redirect(`/too-many-requests`),
      401: () =>
        redirect(
          `/${slug}/portal/request?${new URLSearchParams(searchParams)}`,
        ),
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getOrganizationOrNotFound = cache(_getOrganizationOrNotFound)
