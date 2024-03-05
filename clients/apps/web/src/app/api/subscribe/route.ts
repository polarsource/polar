import { getServerSideAPI } from '@/utils/api'
import { requestHost } from '@/utils/nav'
import { ResponseError } from '@polar-sh/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const api = getServerSideAPI()

  const searchParams = request.nextUrl.searchParams
  const subscriptionTierId = searchParams.get('tier') as string
  const organizationId = searchParams.get('organization_id') as
    | string
    | undefined

  // Build success URL with custom domain support
  const host = requestHost(request)
  const successURL = `${host.protocol}://${host.host}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`

  try {
    const { url } = await api.subscriptions.createSubscribeSession({
      subscribeSessionCreate: {
        tier_id: subscriptionTierId,
        organization_subscriber_id: organizationId,
        success_url: successURL,
      },
    })
    return new NextResponse(undefined, {
      status: 303,
      headers: { Location: url as string },
    })
  } catch (err) {
    if (err instanceof ResponseError) {
      const response = err.response
      const data = await response.json()
      return new NextResponse(JSON.stringify(data.detail), {
        status: response.status,
      })
    }
    throw err
  }
}
