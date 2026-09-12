import { CONFIG } from '@/utils/config'
import { MCP_ORG_COOKIE_KEY } from '@/utils/mcp-session'
import { NextResponse } from 'next/server'

export async function GET() {
  const response = NextResponse.redirect(`${CONFIG.BASE_URL}/v1/auth/logout`, {
    status: 302,
  })

  response.cookies.set(CONFIG.AUTH_MCP_COOKIE_KEY, '', {
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: 0,
  })
  response.cookies.set(MCP_ORG_COOKIE_KEY, '', {
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: 0,
  })

  return response
}
