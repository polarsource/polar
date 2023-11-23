import { CONFIG } from 'polarkit'
import { posthog } from 'posthog-js'

export const isFeatureEnabled = (key: string): boolean => {
  if (CONFIG.ENVIRONMENT == 'development') {
    return true
  }

  return posthog.isFeatureEnabled(key) || false
}

export const isPolarEmployee = (): boolean => {
  if (CONFIG.ENVIRONMENT == 'development') {
    return true
  }

  return posthog.get_property('is_polar_employee') ?? false
}
