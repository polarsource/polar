import { getServerSideAPI } from '@/utils/api/serverside'
import { ResponseError } from '@polar-sh/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const api = getServerSideAPI()

  const searchParams = request.nextUrl.searchParams
  const priceId = searchParams.get('price') as string
  const subscriptionId = searchParams.get('subscription') as string | null

  const requestURL = new URL(request.url)
  const successURL = `${requestURL.protocol}//${requestURL.host}/checkout/success?session_id={CHECKOUT_SESSION_ID}`

  try {
    const { url } = await api.legacyCheckouts.create({
      body: {
        product_price_id: priceId,
        success_url: successURL,
        subscription_id: subscriptionId,
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
