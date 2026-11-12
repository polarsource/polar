'use client'

import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import * as Sentry from '@sentry/nextjs'
import { useCallback, useState } from 'react'

const MAX_HISTORY_LENGTH = 5

export type AupVerdict = schemas['ProductDescriptionCheck']['verdict']

type ValidateParams = Omit<schemas['ProductDescriptionCheckRequest'], 'history'>

interface ValidateResult {
  ok: boolean
  verdict: AupVerdict | null
}

export const useAupValidation = () => {
  const [history, setHistory] = useState<
    schemas['ProductDescriptionCheckRound'][]
  >([])
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
      const { data, error } = await api
        .POST('/v1/organizations/description-check', {
          body: {
            product_description,
            selling_categories,
            pricing_models,
            history: history.slice(-MAX_HISTORY_LENGTH),
          },
        })
        .catch((error: unknown) => ({ data: undefined, error }))
      setIsValidating(false)

      if (!data) {
        Sentry.captureException(error)
        return { ok: false, verdict: null }
      }

      if (data.verdict === 'DENY' || data.verdict === 'CLARIFY') {
        setHistory((prev) => [
          ...prev,
          { product_description, verdict: data.verdict },
        ])
        setVerdict(data.verdict)
        setMessage(data.message ?? null)
      } else {
        setVerdict(null)
        setMessage(null)
      }

      return { ok: true, verdict: data.verdict }
    },
    [history],
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
