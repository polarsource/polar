import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const return_to = searchParams.get('return_to') ?? '/'

  cookies().set('polar_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    expires: 0,
  })

  redirect(return_to)
}
