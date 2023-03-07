import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { Badge } from 'polarkit/components/Badge'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: NextRequest) {
  return new ImageResponse(<Badge />, {
    width: 550,
    height: 47,
  })
}
