'use client'

import { api } from '@/../../../packages/polarkit'
import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks'
import { useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useState } from 'react'

export default function Page() {
  const router = useRouter()

  const search = useSearchParams()

  const code = search?.get('code')
  const state = search?.get('state')

  const session = useAuth()
  const [error, setError] = useState<string | null>(null)

  const exchange = async (code: string, state: string) => {
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
          .then((user) => {
            posthog.identify(`user:${user.id}`)
            router.push(response.goto_url || '/login/init')
          })
      } else {
        setError('Invalid response')
      }
    } catch (err) {
      setError('Something went wrong exchanging the OAuth code for a cookie')
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

  useEffect(() => {
    // This user is already authenticated
    if (session.authenticated) {
      router.push('/login/init')
    }
  }, [session.authenticated])

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
