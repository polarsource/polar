'use client'

import * as Sentry from '@sentry/nextjs'
import { nanoid } from 'nanoid'
import { useCallback, useState } from 'react'
import type {
  AnswerEvaluation,
  AupVerdict,
  FollowUpQuestion,
} from '@/utils/aup'

export interface AupHistoryEntry {
  product_description: string
  verdict: string
  message?: string | null
  triggers?: string[]
  answers?: Record<string, string>
  answer_evaluations?: AnswerEvaluation[]
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

interface Options {
  followUpEnabled?: boolean
}

export const useAupValidation = ({ followUpEnabled = false }: Options = {}) => {
  const [conversationId] = useState(() => nanoid())
  const [history, setHistory] = useState<AupHistoryEntry[]>([])
  const [verdict, setVerdict] = useState<'DENY' | 'CLARIFY' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([])
  const [answers, setAnswersState] = useState<Record<string, string>>({})
  const [evaluations, setEvaluations] = useState<
    Record<string, { is_relevant: boolean; reason: string | null }>
  >({})
  const [isValidating, setIsValidating] = useState(false)

  const reset = useCallback(() => {
    setVerdict(null)
    setMessage(null)
    setQuestions([])
    setAnswersState({})
    setEvaluations({})
  }, [])

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswersState((prev) => ({ ...prev, [id]: value }))
    setEvaluations((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
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
            follow_up_enabled: followUpEnabled,
            ...(followUpEnabled && Object.keys(answers).length > 0
              ? { follow_up_answers: answers }
              : {}),
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
        message?: string | null
        triggers?: string[]
        questions?: FollowUpQuestion[]
        answer_evaluations?: AnswerEvaluation[]
      } = await res.json()

      const nextEvaluations: Record<
        string,
        { is_relevant: boolean; reason: string | null }
      > = {}
      for (const e of data.answer_evaluations ?? []) {
        nextEvaluations[e.question_id] = {
          is_relevant: e.is_relevant,
          reason: e.reason ?? null,
        }
      }
      setEvaluations(nextEvaluations)

      if (data.verdict === 'DENY' || data.verdict === 'CLARIFY') {
        const nextQuestions = followUpEnabled ? (data.questions ?? []) : []
        setHistory((prev) => [
          ...prev,
          {
            product_description,
            verdict: data.verdict,
            message: data.message,
            ...(followUpEnabled
              ? {
                  triggers: data.triggers ?? [],
                  answers: { ...answers },
                  answer_evaluations: data.answer_evaluations ?? [],
                }
              : {}),
          },
        ])
        setVerdict(data.verdict)
        setMessage(data.message ?? null)
        setQuestions(nextQuestions)
      } else {
        setVerdict(null)
        setMessage(null)
      }

      setIsValidating(false)
      return { ok: true, verdict: data.verdict }
    },
    [conversationId, history, followUpEnabled, answers],
  )

  return {
    verdict,
    message,
    questions,
    answers,
    evaluations,
    setAnswer,
    history,
    isValidating,
    validate,
    reset,
  }
}
