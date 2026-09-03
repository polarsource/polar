import { createPolar, type Environment } from '@polar-sh/sdk/2026-04'
import { type NextRequest, NextResponse } from 'next/server'

interface CustomerPortalBaseConfig {
  accessToken: string
  environment?: Environment
  returnUrl?: string
}

interface CustomerPortalCustomerIdConfig extends CustomerPortalBaseConfig {
  getCustomerId: (req: NextRequest) => Promise<string>
  getExternalCustomerId?: never
}

interface CustomerPortalExternalCustomerIdConfig extends CustomerPortalBaseConfig {
  getCustomerId?: never
  getExternalCustomerId: (req: NextRequest) => Promise<string>
}

function configIsExternalCustomerIdConfig(
  config: CustomerPortalConfig,
): config is CustomerPortalExternalCustomerIdConfig {
  return typeof config.getExternalCustomerId === 'function'
}

export type CustomerPortalConfig =
  | CustomerPortalCustomerIdConfig
  | CustomerPortalExternalCustomerIdConfig

export const CustomerPortal = (config: CustomerPortalConfig) => {
  const { accessToken, environment, returnUrl } = config

  const polar = createPolar({
    accessToken,
    environment,
  })

  return async (req: NextRequest) => {
    const decodedReturnUrl = returnUrl
      ? decodeURI(new URL(returnUrl).toString())
      : undefined

    if (configIsExternalCustomerIdConfig(config)) {
      const externalCustomerId = await config.getExternalCustomerId(req)

      if (!externalCustomerId) {
        return NextResponse.json(
          { error: 'externalCustomerId not defined' },
          { status: 400 },
        )
      }

      try {
        const { customer_portal_url } = await polar.customerSessions.create({
          return_url: decodedReturnUrl,
          external_customer_id: externalCustomerId,
        })

        return NextResponse.redirect(customer_portal_url)
      } catch (error) {
        console.error(error)
        return NextResponse.error()
      }
    }

    const customerId = await config.getCustomerId(req)

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId not defined' },
        { status: 400 },
      )
    }

    try {
      const { customer_portal_url } = await polar.customerSessions.create({
        return_url: decodedReturnUrl,
        customer_id: customerId,
      })

      return NextResponse.redirect(customer_portal_url)
    } catch (error) {
      console.error(error)
      return NextResponse.error()
    }
  }
}
