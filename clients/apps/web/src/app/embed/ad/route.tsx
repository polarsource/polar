import { NextRequest } from 'next/server'

import { getServerSideAPI } from '@/utils/client/serverside'
import { unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const dark = searchParams.get('dark')

  if (!id) {
    return notFound()
  }

  const api = getServerSideAPI()

  const [ad, _] = await Promise.all([
    unwrap(api.GET('/v1/advertisements/{id}', { params: { path: { id } } })),
    unwrap(
      api.POST('/v1/advertisements/{id}/view', { params: { path: { id } } }),
    ),
  ])

  const url = dark && ad.image_url_dark ? ad.image_url_dark : ad.image_url

  // Proxy image to control cache headers
  const img = await fetch(url, { cache: 'default' })
  return new Response(await img.blob(), {
    headers: {
      'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
    },
  })
}
