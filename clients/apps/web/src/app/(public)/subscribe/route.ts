import { Configuration, PolarAPI } from '@polar-sh/sdk'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { getServerURL } from 'polarkit/api'

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const api = new PolarAPI(
    new Configuration({
      basePath: getServerURL(),
      credentials: 'include',
      headers: {
        Cookie: cookieStore.toString(),
      },
    }),
  )

  const searchParams = request.nextUrl.searchParams
  const subscriptionTierId = searchParams.get('tier') as string

  const { url } = await api.subscriptions.createSubscribeSession({
    subscribeSessionCreate: {
      tier_id: subscriptionTierId,
      success_url: `${request.nextUrl.protocol}//${request.nextUrl.host}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    },
  })

  return new Response(undefined, {
    status: 303,
    headers: { Location: url as string },
  })
}
