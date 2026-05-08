'use client'

import * as Sentry from '@sentry/nextjs'
import { nanoid } from 'nanoid'
import { useCallback, useState } from 'react'

export type AupVerdict = 'APPROVE' | 'DENY' | 'CLARIFY'

export interface AupHistoryEntry {
  product_description: string
  verdict: string
  message?: string
}

interface ValidateParams {
  product_description: string
  selling_categories: string[]
  pricing_models: string[]
}

interface ValidateResult {
  ok: boolean
  verdict: AupVerdict | null
}

export const useAupValidation = () => {
  const [conversationId] = useState(() => nanoid())
  const [history, setHistory] = useState<AupHistoryEntry[]>([])
  const [verdict, setVerdict] = useState<'DENY' | 'CLARIFY' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const reset = useCallback(() => {
    setVerdict(null)
    setMessage(null)
  }, [])

  const validate = useCallback(
    async ({
      product_description,
      selling_categories,
      pricing_models,
    }: ValidateParams): Promise<ValidateResult> => {
      setIsValidating(true)
      let res: Response
      try {
        res = await fetch('/onboarding/validate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            product_description,
            selling_categories,
            pricing_models,
            history,
          }),
        })
      } catch (error) {
        Sentry.captureException(error)
        setIsValidating(false)
        return { ok: false, verdict: null }
      }

      if (!res.ok) {
        Sentry.captureException(
          new Error(`AUP validation failed with status ${res.status}`),
        )
        setIsValidating(false)
        return { ok: false, verdict: null }
      }

      const data: {
        verdict: AupVerdict
        confidence: number
        message?: string
      } = await res.json()

      if (data.verdict === 'DENY' || data.verdict === 'CLARIFY') {
        setHistory((prev) => [
          ...prev,
          {
            product_description,
            verdict: data.verdict,
            message: data.message,
          },
        ])
        setVerdict(data.verdict)
        setMessage(data.message ?? null)
      } else {
        setVerdict(null)
        setMessage(null)
      }

      setIsValidating(false)
      return { ok: true, verdict: data.verdict }
    },
    [conversationId, history],
  )

  return {
    verdict,
    message,
    history,
    isValidating,
    validate,
    reset,
  }
}
