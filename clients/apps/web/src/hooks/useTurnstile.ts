'use client'

import { CONFIG } from '@/utils/config'
import { useCallback, useEffect, useRef } from 'react'

interface TurnstileRenderOptions {
  sitekey: string
  action: string
  appearance?: 'always' | 'execute' | 'interaction-only'
  execution?: 'render' | 'execute'
  size?: 'normal' | 'flexible' | 'compact'
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

interface TurnstileWindow extends Window {
  turnstile?: {
    remove: (widgetId: string) => void
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string
    execute: (widgetId: string) => void
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
  const executedRef = useRef(false)
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

  const reset = useCallback(() => {
    const turnstile = (window as TurnstileWindow).turnstile
    const widgetId = widgetIdRef.current
    tokenRef.current = null
    executedRef.current = false
    if (turnstile && widgetId) {
      turnstile.reset(widgetId)
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
      // Hold the challenge until execute() is called (on first email focus)
      // rather than running it eagerly at render.
      execution: 'execute',
      size: 'flexible',
      callback: settleToken,
      // A failed or expired challenge leaves the widget without a token and
      // Turnstile doesn't queue another execute on its own, so re-arm it for
      // the next getToken() instead of letting that one wait out the timeout.
      'error-callback': () => {
        settleToken(null)
        reset()
      },
      'expired-callback': reset,
    })
  }, [action, settleToken, reset])

  useEffect(() => {
    render()

    return () => {
      const turnstile = (window as TurnstileWindow).turnstile
      const widgetId = widgetIdRef.current
      if (turnstile && widgetId) {
        turnstile.remove(widgetId)
      }
      widgetIdRef.current = null
      executedRef.current = false
      tokenRef.current = null
      waitersRef.current = []
    }
  }, [render])

  // Kick off the deferred challenge. Safe to call repeatedly — it runs the
  // challenge only once per widget lifecycle.
  const execute = useCallback(() => {
    const turnstile = (window as TurnstileWindow).turnstile
    const widgetId = widgetIdRef.current
    if (!turnstile || !widgetId || executedRef.current) {
      return
    }
    executedRef.current = true
    turnstile.execute(widgetId)
  }, [])

  const getToken = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        if (tokenRef.current) {
          resolve(tokenRef.current)
          return
        }

        // Fallback: a submit without a prior focus (e.g. autofill) still needs
        // the challenge started, or getToken would wait out the timeout.
        execute()

        const timeoutId = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS)
        waitersRef.current.push((token) => {
          clearTimeout(timeoutId)
          resolve(token)
        })
      }),
    [execute],
  )

  return { containerRef, render, execute, getToken, reset }
}
