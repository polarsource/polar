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

export const setSubscriptionPlan = (planId: BillingPlanId): void => {
  state = { ...state, planId }
  listeners.forEach((listener) => listener())
}

export const useBillingSubscription = (): BillingSubscription =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
