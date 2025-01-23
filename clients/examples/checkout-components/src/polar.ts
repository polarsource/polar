import { PolarCore } from '@polar-sh/sdk/core'

export const getServerURL = () => {
  return process.env.NEXT_PUBLIC_POLAR_SERVER_URL
}

export const getClient = () => {
  return new PolarCore({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    serverURL: process.env.NEXT_PUBLIC_POLAR_SERVER_URL,
  })
}
