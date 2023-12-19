import { NextResponse, type NextRequest } from 'next/server'
import { CONFIG } from 'polarkit'

export async function GET(
  request: NextRequest,
  { params: { graph, type } }: { params: { type: string; graph: string } },
) {
  /*
   * Kroki is an open-source service rendering different types of diagrams programmatically
   * Read more: https://kroki.io/
   */
  const response = await fetch(`https://kroki.io/${type}/png/${graph}`, {
    headers: {
      // Play fair and explicitly announce us
      'User-Agent': `polar.sh-${CONFIG.ENVIRONMENT}`,
    },
  })

  return new NextResponse(response.body, {
    headers: {
      ...response.headers,
      /*
       * Be nice with Kroki and try to leverage caching in our infrastructure.
       * - Cache in user's browser for 60 seconds
       * - Cache in Vercel's Edge network for 5 days
       * Ref: https://vercel.com/docs/edge-network/headers#cache-control-header
       */
      'Cache-Control': 'max-age=60, s-maxage=432000',
    },
  })
}
