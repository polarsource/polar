import { getServerSideAPI } from '@/utils/api'
import { NextRequest, NextResponse } from 'next/server'

// exchange the magic link with the server
const handleMagicLinkToken = async (magic: string): Promise<string[]> => {
  const api = getServerSideAPI()

  try {
    const user = await api.users.getAuthenticated()
    if (user.id) {
      // user is already logged in
      return []
    }
  } catch {}

  try {
    const magicLink = await api.magicLink.magicLinkAuthenticateRaw({
      token: magic,
    })
    const val = await magicLink.value()
    if (val.success) {
      return magicLink.raw.headers.getSetCookie()
    }
  } catch {}

  return []
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/_next/')) {
    return
  }

  // Intercept all requests with magic_link_token set.
  // Try to authenticate with this token, and redirect to the URL with the token stripped.
  if (request.nextUrl.searchParams.has('magic_link_token')) {
    const magic = request.nextUrl.searchParams.get('magic_link_token')

    let setCookies: string[] = []

    if (magic) {
      setCookies = await handleMagicLinkToken(magic)
    }

    const target = new URL(request.nextUrl)

    // remove magic_link_token from URL even if it was invalid
    target.searchParams.delete('magic_link_token')

    // redirect
    const response = NextResponse.redirect(target)

    // forward set-cookie header(s) to client
    for (const setCookie of setCookies) {
      response.headers.set('Set-Cookie', setCookie)
    }
    return response
  }

  return
}
