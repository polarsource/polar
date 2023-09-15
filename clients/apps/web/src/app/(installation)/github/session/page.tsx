'use client'

import { api } from '@/../../../packages/polarkit'
import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import { ApiError } from 'polarkit/api'
import { useEffect, useRef, useState } from 'react'

export default function Page() {
  const router = useRouter()

  const search = useSearchParams()
  const code = search?.get('code')
  const state = search?.get('state')

  const session = useAuth()
  const loading = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const exchange = async (code: string, state: string) => {
    if (loading.current) {
      return
    }

    loading.current = true
    try {
      const response = await api.integrations.githubCallback({
        code: code,
        state: state,
      })

      if (response.success) {
        await session
          .login((authenticated: boolean) => {
            if (!authenticated) {
              setError('Something went wrong logging in')
            }
          })
          .then(() => {
            router.push(response.goto_url || '/login/init')
          })
      } else {
        setError('Invalid response')
      }
    } catch (err) {
      let errorMessage =
        'Something went wrong exchanging the OAuth code for a cookie'
      if (err instanceof ApiError && err.body.detail) {
        errorMessage = err.body.detail
      }
      setError(errorMessage)
    } finally {
      loading.current = false
    }
  }

  // Try once on page load
  useEffect(() => {
    if (code && state) {
      exchange(code, state)
    } else {
      setError('Cannot authenticate without an OAuth code and state')
    }
  }, [])

  if (error) {
    return (
      <LoadingScreen animate={false}>
        <LoadingScreenError error={error} />
      </LoadingScreen>
    )
  }

  return (
    <LoadingScreen animate={true}>Brewing a fresh access token.</LoadingScreen>
  )
}
