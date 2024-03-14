import { NextResponse, type NextRequest } from 'next/server'
import ogs from 'open-graph-scraper-lite'
import { CONFIG } from 'polarkit'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  const response = await fetch(url ?? '', {
    headers: {
      'User-Agent': `polar.sh-${CONFIG.ENVIRONMENT} bot`,
    },
  }).catch(console.error)

  if ((response && !response.ok) || !response) {
    return new NextResponse(null, {
      status: 400,
    })
  }

  const html = await response.text()

  const opengraph = await ogs({ html })

  return new NextResponse(JSON.stringify(opengraph.result), {
    headers: {
      ...response.headers,
      /*
       * Be nice with OGS and try to leverage caching in our infrastructure.
       * - Cache in user's browser for 1 hour
       * - Cache in Vercel's Edge network for 5 days
       * Ref: https://vercel.com/docs/edge-network/headers#cache-control-header
       */
      'Cache-Control': 'max-age=3600, s-maxage=432000',
      'Content-Type': 'application/json',
    },
  })
}
