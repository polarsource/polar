'use client'

import { CONFIG } from '@/utils/config'
import { useCallback, useEffect, useRef } from 'react'

interface TurnstileRenderOptions {
  sitekey: string
  action: string
  appearance?: 'always' | 'execute' | 'interaction-only'
  size?: 'normal' | 'flexible' | 'compact'
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

interface TurnstileWindow extends Window {
  turnstile?: {
    remove: (widgetId: string) => void
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string
    reset: (widgetId: string) => void
  }
}

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// Cloudflare's invisible test sitekey always passes without showing a widget,
// and its dummy token verifies against the paired test secret (server
// .env.template), so local login works without the production secret.
// The env override serves deployments on domains outside the production
// sitekey's allowlist (e.g. *.vercel.app), paired with a matching secret.
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  (CONFIG.ENVIRONMENT === 'development'
    ? '1x00000000000000000000BB'
    : '0x4AAAAAAD7cBrbpX3kX8K9g')

// The challenge runs in the background, so a submit may land before a token
// exists. Give up rather than leaving the form spinning forever.
const TOKEN_TIMEOUT_MS = 15000

export const useTurnstile = (action: string) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const waitersRef = useRef<((token: string | null) => void)[]>([])

  const settleToken = useCallback((token: string | null) => {
    tokenRef.current = token
    const waiters = waitersRef.current
    waitersRef.current = []
    for (const waiter of waiters) {
      waiter(token)
    }
  }, [])

  const render = useCallback(() => {
    const turnstile = (window as TurnstileWindow).turnstile
    const container = containerRef.current
    if (!turnstile || !container || widgetIdRef.current) {
      return
    }

    widgetIdRef.current = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      action,
      appearance: 'interaction-only',
      size: 'flexible',
      callback: settleToken,
      'error-callback': () => settleToken(null),
      // Turnstile refreshes expired tokens on its own, so only drop the stale
      // one and let the next callback settle any pending submit.
      'expired-callback': () => {
        tokenRef.current = null
      },
    })
  }, [action, settleToken])

  useEffect(() => {
    render()

    return () => {
      const turnstile = (window as TurnstileWindow).turnstile
      const widgetId = widgetIdRef.current
      if (turnstile && widgetId) {
        turnstile.remove(widgetId)
      }
      widgetIdRef.current = null
      tokenRef.current = null
      waitersRef.current = []
    }
  }, [render])

  const getToken = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        if (tokenRef.current) {
          resolve(tokenRef.current)
          return
        }

        const timeoutId = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS)
        waitersRef.current.push((token) => {
          clearTimeout(timeoutId)
          resolve(token)
        })
      }),
    [],
  )

  const reset = useCallback(() => {
    const turnstile = (window as TurnstileWindow).turnstile
    const widgetId = widgetIdRef.current
    tokenRef.current = null
    if (turnstile && widgetId) {
      turnstile.reset(widgetId)
    }
  }, [])

  return { containerRef, render, getToken, reset }
}
