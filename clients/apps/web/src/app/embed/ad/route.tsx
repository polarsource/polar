import { NextRequest } from 'next/server'

import { getServerSideAPI } from '@/utils/api'
import { notFound, redirect } from 'next/navigation'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const dark = searchParams.get('dark')

  if (!id) {
    return notFound()
  }

  const ad = await getServerSideAPI().advertisements.trackView({ id: id })

  if (dark && ad.image_url_dark) {
    redirect(ad.image_url_dark)
  } else {
    redirect(ad.image_url)
  }
}
