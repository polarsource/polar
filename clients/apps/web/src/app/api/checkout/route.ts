import { getServerSideAPI } from '@/utils/client/serverside'
import { isCrawler } from '@/utils/crawlers'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const api = getServerSideAPI()

  const userAgent = request.headers.get('user-agent')
  if (userAgent && isCrawler(userAgent)) {
    return new NextResponse(null, {
      status: 204,
    })
  }

  const searchParams = request.nextUrl.searchParams
  const priceId = searchParams.get('price') as string

  const {
    data: checkout,
    error,
    response,
  } = await api.POST('/v1/checkouts/client/', {
    body: {
      product_price_id: priceId,
      from_legacy_checkout_link: true,
    },
  })
  if (error) {
    return new NextResponse(JSON.stringify(error), {
      status: response.status,
    })
  }
  return new NextResponse(undefined, {
    status: 303,
    headers: { Location: checkout.url },
  })
}
