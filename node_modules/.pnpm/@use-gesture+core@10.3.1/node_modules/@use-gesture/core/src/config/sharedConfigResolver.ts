import { Target } from '../types'
import { SUPPORT } from './support'

export const sharedConfigResolver = {
  target(value: Target) {
    if (value) {
      return () => ('current' in value ? value.current : value)
    }
    return undefined
  },
  enabled(value = true) {
    return value
  },
  window(value = SUPPORT.isBrowser ? window : undefined) {
    return value
  },
  eventOptions({ passive = true, capture = false } = {}) {
    return { passive, capture }
  },
  transform(value: any) {
    return value
  }
}
