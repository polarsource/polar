import { getServerSideAPI } from '@/utils/api'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const return_to = searchParams.get('return_to') ?? '/'

  if (!token) {
    notFound()
  }

  const api = getServerSideAPI()

  const secret = process.env.POLAR_CUSTOM_DOMAIN_FORWARD_SECRET
  if (!secret) {
    throw new Error('POLAR_CUSTOM_DOMAIN_FORWARD_SECRET not set')
  }

  // exchange the token for a auth token

  const auth = await api.auth.customDomainExchange({
    customDomainExchangeRequest: {
      token,
      secret,
    },
  })

  cookies().set('polar_session', auth.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    expires: new Date(auth.expires_at),
  })

  redirect(return_to)
}
