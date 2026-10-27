import { RuntimeSDK } from '@polar-sh/polar'
import config from './polar.config'

export const polar = RuntimeSDK(config, {
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? '',
  environment: 'sandbox',
})
