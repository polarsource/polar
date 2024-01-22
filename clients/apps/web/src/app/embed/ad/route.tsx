import { NextRequest } from 'next/server'

import { getServerSideAPI } from '@/utils/api'
import { notFound } from 'next/navigation'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const dark = searchParams.get('dark')

  if (!id) {
    return notFound()
  }

  const ad = await getServerSideAPI().advertisements.trackView(
    { id: id },
    { cache: 'no-cache' },
  )

  const url = dark && ad.image_url_dark ? ad.image_url_dark : ad.image_url

  // Proxy image to control cache headers
  const img = await fetch(url, { cache: 'default' })
  return new Response(await img.blob(), {
    headers: {
      'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
    },
  })
}
