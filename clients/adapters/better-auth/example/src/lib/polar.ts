import { createPolarCore } from '@polar-sh/sdk/2026-10'

export const polarSDK = createPolarCore({
  accessToken: process.env['POLAR_ACCESS_TOKEN'] as string,
  environment: 'sandbox',
})
