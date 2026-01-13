import { getAuthenticatedUser } from '@/utils/user'
import { NextResponse } from 'next/server'

interface ValidateURLRequest {
  url: string
}

interface ValidateURLResponse {
  reachable: boolean
  status?: number
  error?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as ValidateURLRequest
    const { url } = body

    if (!url) {
      return NextResponse.json(
        {
          reachable: false,
          error: 'URL is required',
        } satisfies ValidateURLResponse,
        { status: 400 },
      )
    }

    // Validate URL format
    try {
      const parsedURL = new URL(url)
      if (!['http:', 'https:'].includes(parsedURL.protocol)) {
        return NextResponse.json(
          {
            reachable: false,
            error: 'Invalid URL protocol',
          } satisfies ValidateURLResponse,
          { status: 400 },
        )
      }
    } catch {
      return NextResponse.json(
        {
          reachable: false,
          error: 'Invalid URL format',
        } satisfies ValidateURLResponse,
        { status: 400 },
      )
    }

    // Perform HEAD request with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Polar URL Validator/1.0',
        },
      })

      clearTimeout(timeoutId)

      const isReachable = response.status >= 200 && response.status < 400

      return NextResponse.json({
        reachable: isReachable,
        status: response.status,
      } satisfies ValidateURLResponse)
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({
          reachable: false,
          error: 'Request timed out',
        } satisfies ValidateURLResponse)
      }

      return NextResponse.json({
        reachable: false,
        error: 'Unable to reach URL',
      } satisfies ValidateURLResponse)
    }
  } catch (error) {
    return NextResponse.json(
      {
        reachable: false,
        error: (error as Error).message,
      } satisfies ValidateURLResponse,
      { status: 500 },
    )
  }
}
