import { NextRequest, NextResponse } from 'next/server'
import { MOCKED_METERS } from '../data'

export const GET = async (
  _: NextRequest,
  { params: { slug } }: { params: { slug: string } },
) => {
  if (!slug) {
    return NextResponse.json(
      { error: 'Meter slug is required' },
      { status: 400 },
    )
  }

  const meter = MOCKED_METERS.find((meter) => meter.slug === slug)

  return NextResponse.json(meter, { status: 200 })
}
