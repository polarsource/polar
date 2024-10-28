'use client'

import { CONFIG } from '@/utils/config'
import { UserRead } from '@polar-sh/sdk'
import { PostHog, Properties } from 'posthog-js'
import { usePostHog as useOfficialPostHog } from 'posthog-js/react'

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
  | 'articles'
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
  client: PostHog
  capture: (event: EventName, properties?: Properties) => void
  identify: (user: UserRead) => void
  isFeatureEnabled: (key: string) => boolean
  logout: () => void
}

export const usePostHog = (): PolarHog => {
  const posthog = useOfficialPostHog()

  const capture = (event: EventName, properties?: Properties) => {
    posthog?.capture(event, properties)
  }

  const identify = (user: UserRead) => {
    if (!posthog) return

    const posthogId = `user:${user.id}`
    if (posthog.get_distinct_id() !== posthogId) {
      posthog.identify(posthogId, {
        email: user.email,
      })
    }
  }

  const isFeatureEnabled = (key: string): boolean => {
    if (CONFIG.ENVIRONMENT == 'development') {
      return true
    }

    return posthog?.isFeatureEnabled(key) || false
  }

  const logout = () => {
    capture('global:user:logout:done')
    posthog?.reset()
  }

  return {
    client: posthog,
    capture,
    identify,
    isFeatureEnabled,
    logout,
  }
}
