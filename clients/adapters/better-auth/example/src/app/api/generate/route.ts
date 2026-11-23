import { auth } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { prompt } = (await request.json()) as { prompt: string }
  const completion = prompt.split('').reverse().join('')

  await auth.api.ingestUsage({
    headers: request.headers,
    body: {
      event: 'text-generation',
      metadata: {
        characters: completion.length,
      },
    },
  })

  return Response.json({ completion })
}
