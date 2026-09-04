import { createPolar } from '@polar-sh/sdk/2026-04'

export const polarSDK = createPolar({
  accessToken: process.env['POLAR_ACCESS_TOKEN'] as string,
  environment: 'sandbox',
})
