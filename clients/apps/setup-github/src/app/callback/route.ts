import { NextResponse } from 'next/server'

import { promises as fs } from 'fs'

const addEnv = (contents: string, key: string, value: any): string => {
  if (contents.includes(key)) {
    const start = contents.indexOf(key)
    const end = contents.indexOf('\n', start)
    return (
      contents.substring(0, start) +
      `${key}=${JSON.stringify(value)}` +
      contents.substring(end)
    )
  } else {
    return contents + '\n' + `${key}=${JSON.stringify(value)}`
  }
}

const serverEnv = async (
  path: string,
  host: string,
  hostProto: string,
  app: any,
) => {
  let file: string = ''

  try {
    file = await fs.readFile(path, 'utf8')
  } catch (e) {
    // not exists
  }

  const adds: Record<string, any> = {
    POLAR_POSTGRES_USER: 'polar',
    POLAR_POSTGRES_PWD: 'polar',
    POLAR_POSTGRES_DATABASE: 'polar',
    POLAR_POSTGRES_PORT: '5432',
    POLAR_POSTGRES_HOST: 'db',
    POLAR_REDIS_HOST: 'redis',
    POLAR_REDIS_PORT: '6379',

    POLAR_CORS_ORIGINS: `["http://127.0.0.1:3000", "http://localhost:3000", "https://github.com", "${hostProto}:3000"]`,
    POLAR_BASE_URL: `${hostProto}:8000/api/v1`,
    POLAR_FRONTEND_BASE_URL: `${hostProto}:3000`,
    POLAR_AUTH_COOKIE_DOMAIN: `${host}`,
    POLAR_GITHUB_REDIRECT_URL: `${hostProto}:3000/github/session`,
  }

  // Add GitHub Env vars
  if (app && app.id) {
    adds.POLAR_GITHUB_APP_IDENTIFIER = app.id
    adds.POLAR_GITHUB_APP_WEBHOOK_SECRET = app.webhook_secret
    adds.POLAR_GITHUB_APP_PRIVATE_KEY = app.pem
    adds.POLAR_GITHUB_CLIENT_ID = app.client_id
    adds.POLAR_GITHUB_CLIENT_SECRET = app.client_secret
  }

  let newFile = file
  for (const [key, value] of Object.entries(adds)) {
    newFile = addEnv(newFile, key, value)
  }
  return newFile
}

const webEnv = async (path: string, hostProto: string, app: any) => {
  const file = await fs.readFile(path, 'utf8')

  const adds: Record<string, any> = {
    NEXT_PUBLIC_API_URL: `${hostProto}:8000`,
  }

  if (app && app.id) {
    adds.NEXT_PUBLIC_GITHUB_APP_NAMESPACE = app.slug
  }

  let newFile = file
  for (const [key, value] of Object.entries(adds)) {
    newFile = addEnv(newFile, key, value)
  }
  return newFile
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)

  const host = `${process.env.NEXT_PUBLIC_CODESPACE_NAME}.${process.env.NEXT_PUBLIC_GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
  const hostProto = `https://${host}`

  try {
    const code = searchParams.get('code')

    let parsed: any = undefined

    if (code) {
      const converted = await fetch(
        `https://api.github.com/app-manifests/${code}/conversions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      parsed = await converted.json()

      if (!parsed.id) {
        throw new Error(
          'unexpected response from github: ' + JSON.stringify(parsed),
        )
      }
    }

    // Server .env
    const serverEnvPath = process.cwd() + '/../../../server/.env'
    const newServerEnv = await serverEnv(serverEnvPath, host, hostProto, parsed)
    await fs.writeFile(serverEnvPath, newServerEnv)

    // Web .env
    const webEnvPath = process.cwd() + '/../../../clients/apps/web/.env'
    const newWebEnv = await webEnv(webEnvPath, hostProto, parsed)
    await fs.writeFile(webEnvPath, newWebEnv)

    return NextResponse.json({ res: `${hostProto}:3001/done` })

    //return NextResponse.redirect(new URL(`/done`, request.url))
  } catch (e) {
    console.error(e)
    if (e instanceof Error) {
      return NextResponse.json({ res: e.message })
    }
    return NextResponse.json({ res: 'something went wrong' })
  }
}
