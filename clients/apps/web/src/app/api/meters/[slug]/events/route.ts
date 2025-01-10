import { NextRequest, NextResponse } from 'next/server'
import { MOCKED_METER_EVENTS, MOCKED_METERS } from '../../data'

export const GET = async (
  req: NextRequest,
  { params: { slug } }: { params: { slug: string } },
) => {
  if (!slug) {
    return NextResponse.json(
      { error: 'Meter slug is required' },
      { status: 400 },
    )
  }

  const meterEvents = MOCKED_METER_EVENTS.filter(
    (event) => event.slug === slug,
  ).sort((a, b) => b.created_at.localeCompare(a.created_at))

  return NextResponse.json(
    {
      pagination: { total_count: meterEvents.length, max_page: 1 },
      items: meterEvents,
    },
    { status: 200 },
  )
}

interface MeterEventCreateRequest {
  value: number
  slug: string
  customerId: string
}

export const POST = async (
  req: NextRequest,
  { params: { slug } }: { params: { slug: string } },
) => {
  const { value, customerId } = (await req.json()) as MeterEventCreateRequest

  const meter = MOCKED_METERS.find((meter) => meter.slug === slug)

  if (!meter) {
    return NextResponse.json({ error: 'Meter not found' }, { status: 404 })
  }

  MOCKED_METER_EVENTS.push({
    id: Math.random().toString(36).substring(2, 15),
    slug: meter.slug,
    customerId: customerId,
    value: value,
    created_at: new Date().toISOString(),
  })

  return NextResponse.json({ message: 'Meter event created' }, { status: 200 })
}
