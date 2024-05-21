import { getServerSideAPI } from '@/utils/api/serverside'
import { requestHost } from '@/utils/nav'
import { ResponseError } from '@polar-sh/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const api = getServerSideAPI()

  const searchParams = request.nextUrl.searchParams
  const priceId = searchParams.get('price') as string

  // Build success URL with custom domain support
  const host = requestHost(request)
  const successURL = `${host.protocol}://${host.host}/checkout/success?session_id={CHECKOUT_SESSION_ID}`

  try {
    const { url } = await api.checkouts.createCheckout({
      checkoutCreate: {
        product_price_id: priceId,
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
