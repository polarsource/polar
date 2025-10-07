'use client'

import { PostHogContext } from '@/app/providers'
import { CONFIG } from '@/utils/config'
import type { schemas } from '@polar-sh/client'
import type { JsonType } from '@posthog/core'
import { useCallback, useContext, useMemo } from 'react'

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
  capture: (event: EventName, properties?: { [key: string]: JsonType }) => void
  identify: (user: schemas['UserRead']) => void
  isFeatureEnabled: (key: string) => boolean
  logout: () => void
}

export const usePostHog = (): PolarHog => {
  const { client: posthog, setPersistence } = useContext(PostHogContext)

  const capture: PolarHog['capture'] = useCallback(
    (event, properties) => {
      posthog?.capture(event, properties)
    },
    [posthog],
  )

  const identify: PolarHog['identify'] = useCallback(
    (user) => {
      const posthogId = `user:${user.id}`

      if (!posthog) {
        return
      }

      if (posthog.getDistinctId() !== posthogId) {
        posthog.identify(posthogId, {
          email: user.email,
        })
      }
    },
    [posthog],
  )

  const isFeatureEnabled: PolarHog['isFeatureEnabled'] = useCallback(
    (key) => {
      if (CONFIG.ENVIRONMENT == 'development') {
        return true
      }

      if (!posthog) {
        return false
      }

      return posthog.isFeatureEnabled(key) ?? false
    },
    [posthog],
  )

  const logout: PolarHog['logout'] = useCallback(() => {
    capture('global:user:logout:done')
    posthog?.reset()
  }, [capture, posthog])

  const context = useMemo(
    () => ({
      setPersistence,
      capture,
      identify,
      isFeatureEnabled,
      logout,
    }),
    [setPersistence, capture, identify, isFeatureEnabled, logout],
  )

  return context
}
