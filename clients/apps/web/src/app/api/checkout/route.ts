import { getServerSideAPI } from '@/utils/api/serverside'
import { ResponseError } from '@polar-sh/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const api = getServerSideAPI()

  const searchParams = request.nextUrl.searchParams
  const priceId = searchParams.get('price') as string

  try {
    const { url } = await api.checkouts.clientCreate({
      body: {
        product_price_id: priceId,
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
