import { api } from 'polarkit/api'
import { CancelablePromise } from 'polarkit/api/client'
import { useAuth } from './auth'
import { useEffect, useState } from 'react'

export const useGithubOAuthCallback = (
  code: string,
  state: string,
): {
  success: boolean
  error: string | null
} => {
  const session = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  const login = async () => {
    session.login((authenticated: boolean) => {
      if (authenticated) {
        setSuccess(true)
      } else {
        setError('Something went wrong logging in')
      }
    })
  }

  useEffect(() => {
    let cancelled = false
    let request = CancelablePromise<any>
    if (!code || !state) {
      setError('We need both an OAuth code and state')
      return
    }

    const exchange = async () => {
      try {
        request = api.integrations.githubCallback({
          code: code,
          state: state,
        })
        const response = await request
        const { authenticated } = response
        if (authenticated && !cancelled) {
          await login()
          return
        }
        setError('Invalid response')
      } catch (err) {
        if (err.isCancelled) return
        setError('Something went wrong exchanging the OAuth code for a cookie')
      }
    }

    exchange()
    return () => {
      if (request) {
        request.cancel()
        cancelled = true
      }
    }
  }, [code, state])

  return { success, error }
}
