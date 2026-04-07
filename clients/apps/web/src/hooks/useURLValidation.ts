'use client'

import { api } from '@/utils/client'
import { useCallback, useRef, useState } from 'react'

export type URLValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid'

interface URLValidationResult {
  status: URLValidationStatus
  error?: string
}

interface UseURLValidationOptions {
  organizationId: string
}

interface UseURLValidationReturn {
  status: URLValidationStatus
  error?: string
  validateURL: (url: string) => Promise<void>
  reset: () => void
}

export function useURLValidation({
  organizationId,
}: UseURLValidationOptions): UseURLValidationReturn {
  const [result, setResult] = useState<URLValidationResult>({ status: 'idle' })
  const cacheRef = useRef<Map<string, URLValidationResult>>(new Map())
  const abortControllerRef = useRef<AbortController | null>(null)

  const validateURL = useCallback(
    async (url: string) => {
      // Skip validation for empty URLs
      if (!url || !url.trim()) {
        setResult({ status: 'idle' })
        return
      }

      // Skip validation for invalid URLs (let form validation handle this)
      if (!url.startsWith('https://')) {
        setResult({ status: 'idle' })
        return
      }

      // Check cache
      const cached = cacheRef.current.get(url)
      if (cached) {
        setResult(cached)
        return
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      setResult({ status: 'validating' })

      try {
        const { data, error } = await api.POST(
          '/v1/organizations/{id}/validate-website',
          {
            params: { path: { id: organizationId } },
            body: { url },
            signal: abortControllerRef.current.signal,
          },
        )

        if (error) {
          const newResult: URLValidationResult = {
            status: 'invalid',
            error: 'Failed to validate URL',
          }
          setResult(newResult)
          return
        }

        const newResult: URLValidationResult = {
          status: data.reachable ? 'valid' : 'invalid',
          error: data.error ?? undefined,
        }

        // Cache the result
        cacheRef.current.set(url, newResult)
        setResult(newResult)
      } catch (error) {
        // Ignore aborted requests
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        const newResult: URLValidationResult = {
          status: 'invalid',
          error: 'Failed to validate URL',
        }
        setResult(newResult)
      }
    },
    [organizationId],
  )

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setResult({ status: 'idle' })
  }, [])

  return {
    status: result.status,
    error: result.error,
    validateURL,
    reset,
  }
}
