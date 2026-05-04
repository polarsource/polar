import { useSyncExternalStore } from 'react'
import {
  BillingPlanId,
  BillingSubscription,
  MOCK_SUBSCRIPTION,
} from './mockData'

type Listener = () => void

let state: BillingSubscription = MOCK_SUBSCRIPTION
const listeners = new Set<Listener>()

const subscribe = (listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): BillingSubscription => state

const emit = () => {
  listeners.forEach((listener) => listener())
}

// Apply a plan change immediately. Used for upgrades.
export const applyPlanChange = (planId: BillingPlanId): void => {
  state = { ...state, planId, scheduledPlanChange: null }
  emit()
}

// Schedule a plan change for the end of the current period. Used for downgrades.
export const schedulePlanChange = (
  planId: BillingPlanId,
  effectiveAt: string,
): void => {
  state = { ...state, scheduledPlanChange: { planId, effectiveAt } }
  emit()
}

export const cancelScheduledPlanChange = (): void => {
  state = { ...state, scheduledPlanChange: null }
  emit()
}

export const useBillingSubscription = (): BillingSubscription =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
