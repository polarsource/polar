import { api } from 'polarkit/api'
import { useEffect, useState } from 'react'
import { useAuth } from './auth'

export const useGithubOAuthCallback = (
  code?: string,
  state?: string,
): {
  success: boolean
  error: string | null
  gotoUrl: string | null
} => {
  const session = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const [gotoUrl, setGotoUrl] = useState<string | null>(null)

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
    let request: ReturnType<typeof api.integrations.githubCallback>

    if (!code || !state) {
      setError('Cannot authenticate without an OAuth code and state')
      return
    }

    const exchange = async () => {
      try {
        request = api.integrations.githubCallback({
          code: code,
          state: state,
        })
        const response = await request
        if (response.success && !cancelled) {
          setGotoUrl(response.goto_url || null)
          await login()
          return
        }
        setError('Invalid response')
      } catch (err) {
        if (cancelled) return
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

  return { success, error, gotoUrl }
}
