import { createPolar, type Environment } from '@polar-sh/sdk/2026-04'
import type { StartRouteHandler } from '../types'

export interface CustomerPortalConfig {
  accessToken: string
  getCustomerId: (req: Request) => Promise<string>
  environment?: Environment
  returnUrl?: string
}

export const CustomerPortal = <TPath extends string = string>({
  accessToken,
  environment,
  getCustomerId,
  returnUrl,
}: CustomerPortalConfig): StartRouteHandler<TPath> => {
  const polar = createPolar({
    accessToken,
    environment,
  })

  return async ({ request }) => {
    const retUrl = returnUrl ? new URL(returnUrl) : undefined

    const customerId = await getCustomerId(request)

    if (!customerId) {
      return Response.json({ error: 'customerId not defined' }, { status: 400 })
    }

    try {
      const result = await polar.customerSessions.create({
        customer_id: customerId,
        return_url: retUrl ? decodeURI(retUrl.toString()) : undefined,
      })

      return Response.redirect(result.customer_portal_url)
    } catch (error) {
      console.error(error)
      return Response.error()
    }
  }
}
