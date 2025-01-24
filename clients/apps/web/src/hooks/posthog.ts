'use client'

import { PostHogContext } from '@/app/providers'
import { CONFIG } from '@/utils/config'
import { UserRead } from '@polar-sh/api'
import { useContext } from 'react'

// https://posthog.com/product-engineers/5-ways-to-improve-analytics-data#suggested-naming-guide

// PostHog Events Naming Convention
//
// ${Category}:${Noun}:${Verb}
//
type Surface =
  | 'website'
  | 'docs'
  | 'dashboard'
  | 'storefront'
  // For rare global(ish) events, e.g login, signup...
  // We can use properties to distinguish flywheel etc
  | 'global'

type Category =
  | 'benefits'
  | 'subscriptions'
  | 'user'
  | 'organizations'
  | 'issues'

type Noun = string

// Verbs in past tense
type Verb =
  | 'click'
  | 'submit'
  | 'create'
  | 'view'
  | 'add'
  | 'invite'
  | 'update'
  | 'delete'
  | 'remove'
  | 'start'
  | 'end'
  | 'cancel'
  | 'fail'
  | 'generate'
  | 'send'
  | 'archive'
  | 'done'
  | 'open'
  | 'close'

export type EventName = `${Surface}:${Category}:${Noun}:${Verb}`

export interface PolarHog {
  setPersistence: (
    persistence: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory',
  ) => void
  capture: (event: EventName, properties?: { [key: string]: any }) => void
  identify: (user: UserRead) => void
  isFeatureEnabled: (key: string) => boolean
  logout: () => void
}

export const usePostHog = (): PolarHog => {
  const { client: posthog, setPersistence } = useContext(PostHogContext)

  const capture = (event: EventName, properties?: { [key: string]: any }) => {
    posthog?.capture(event, properties)
  }

  const identify = (user: UserRead) => {
    const posthogId = `user:${user.id}`
    if (!posthog) {
      return
    }
    if (posthog.getDistinctId() !== posthogId) {
      posthog.identify(posthogId, {
        email: user.email,
      })
    }
  }

  const isFeatureEnabled = (key: string): boolean => {
    if (CONFIG.ENVIRONMENT == 'development') {
      return true
    }

    if (!posthog) {
      return false
    }

    return posthog.isFeatureEnabled(key) || false
  }

  const logout = () => {
    capture('global:user:logout:done')
    posthog?.reset()
  }

  return {
    setPersistence,
    capture,
    identify,
    isFeatureEnabled,
    logout,
  }
}
