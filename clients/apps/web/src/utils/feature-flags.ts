import { CONFIG } from 'polarkit'
import { posthog } from 'posthog-js'

export const isFeatureEnabled = (key: string): boolean => {
  if (CONFIG.ENVIRONMENT == 'development') {
    return true
  }

  return posthog.isFeatureEnabled(key) || false
}
