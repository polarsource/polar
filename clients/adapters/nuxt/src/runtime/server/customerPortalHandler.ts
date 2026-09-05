import { createCustomerSessions } from '@polar-sh/sdk/2026-04/services/customer_sessions'
import { createPolarCore, type Environment } from '@polar-sh/sdk/2026-04'
import { createError, sendRedirect } from 'h3'
import type { H3Event } from 'h3'

export interface CustomerPortalConfig {
  accessToken: string
  environment?: Environment
  getCustomerId: (event: H3Event) => Promise<string>
  returnUrl?: string
}

export const CustomerPortal = ({
  accessToken,
  environment,
  getCustomerId,
  returnUrl,
}: CustomerPortalConfig) => {
  const polar = createPolarCore({ accessToken, environment })

  return async (event: H3Event) => {
    const retUrl = returnUrl ? new URL(returnUrl) : undefined

    const customerId = await getCustomerId(event)

    if (!customerId) {
      console.error(
        'Failed to redirect to customer portal, customerId not defined',
      )
      throw createError({
        statusCode: 400,
        message: 'customerId not defined',
      })
    }

    try {
      const result = await createCustomerSessions(polar)({
        customer_id: customerId,
        return_url: retUrl ? decodeURI(retUrl.toString()) : undefined,
      })

      return sendRedirect(event, result.customer_portal_url)
    } catch (error) {
      console.error('Failed to redirect to customer portal', error)
      throw createError({
        statusCode: 500,
        statusMessage: (error as Error).message,
        message: (error as Error).message ?? 'Internal server error',
      })
    }
  }
}
