import { getServerSideAPI } from '@/utils/api'
import { ResponseError } from '@polar-sh/sdk'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const api = getServerSideAPI()

  const searchParams = request.nextUrl.searchParams
  const subscriptionTierId = searchParams.get('tier') as string
  const organizationId = searchParams.get('organization_id') as
    | string
    | undefined

  try {
    const requestURL = new URL(request.url)
    const { url } = await api.subscriptions.createSubscribeSession({
      subscribeSessionCreate: {
        tier_id: subscriptionTierId,
        organization_subscriber_id: organizationId,
        success_url: `${requestURL.protocol}//${requestURL.host}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      },
    })
    return new Response(undefined, {
      status: 303,
      headers: { Location: url as string },
    })
  } catch (err) {
    if (err instanceof ResponseError) {
      const response = err.response
      const data = await response.json()
      return new Response(data.detail, { status: response.status })
    }
    throw err
  }
}
