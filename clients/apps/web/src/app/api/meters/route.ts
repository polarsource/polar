import { NextResponse } from 'next/server'
import { MOCKED_METERS } from './data'

export const GET = async () => {
  return NextResponse.json(
    {
      pagination: { total_count: MOCKED_METERS.length, max_page: 1 },
      items: MOCKED_METERS,
    },
    { status: 200 },
  )
}
