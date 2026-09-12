import { getServerSideAPI } from '@/utils/client/serverside'
import { CONFIG } from '@/utils/config'
import { cookies } from 'next/headers'

export const MCP_ORG_COOKIE_KEY = `${CONFIG.AUTH_MCP_COOKIE_KEY}_org`

export async function generateMCPAccessToken(
  organizationId: string,
): Promise<string> {
  const requestCookies = await cookies()

  const cachedToken = requestCookies.get(CONFIG.AUTH_MCP_COOKIE_KEY)?.value
  const cachedOrg = requestCookies.get(MCP_ORG_COOKIE_KEY)?.value
  if (cachedToken && cachedOrg === organizationId) {
    return cachedToken
  }

  const userSessionToken = requestCookies.get(CONFIG.AUTH_COOKIE_KEY)
  if (!userSessionToken) {
    throw new Error('No user session cookie found')
  }

  const client = await getServerSideAPI()
  const { data, error } = await client.POST('/v1/oauth2/token', {
    body: {
      grant_type: 'web',
      client_id: process.env.MCP_OAUTH2_CLIENT_ID!,
      client_secret: process.env.MCP_OAUTH2_CLIENT_SECRET!,
      session_token: userSessionToken.value,
      sub_type: 'organization',
      sub: organizationId,
      scope: null,
    },
    bodySerializer(body) {
      const fd = new FormData()
      for (const [key, value] of Object.entries(body)) {
        if (value) {
          fd.append(key, value)
        }
      }
      return fd
    },
  })

  if (error) {
    throw new Error('Failed to generate OAT')
  }

  const accessToken = data.access_token
  if (!accessToken) {
    throw new Error('Failed to generate OAT')
  }

  const expires = new Date(Date.now() + data.expires_in * 1000)

  requestCookies.set(CONFIG.AUTH_MCP_COOKIE_KEY, accessToken, {
    httpOnly: true,
    secure: true,
    expires,
  })
  requestCookies.set(MCP_ORG_COOKIE_KEY, organizationId, {
    httpOnly: true,
    secure: true,
    expires,
  })

  return accessToken
}

export async function hasMCPSessionForOrganization(
  organizationId: string,
): Promise<boolean> {
  const requestCookies = await cookies()
  return (
    requestCookies.has(CONFIG.AUTH_MCP_COOKIE_KEY) &&
    requestCookies.get(MCP_ORG_COOKIE_KEY)?.value === organizationId
  )
}
