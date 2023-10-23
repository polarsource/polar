'use client'

import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks'
import { ResponseError } from '@polar-sh/sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from 'polarkit/api'
import { useEffect, useRef, useState } from 'react'

export default function Page() {
  const router = useRouter()

  const search = useSearchParams()
  const code = search?.get('code')
  const state = search?.get('state')

  const session = useAuth()
  const loading = useRef(false)
  const [error, setError] = useState<string | null>(null)

  // Try once on page load
  useEffect(() => {
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
          const { request } = session.login((authenticated: boolean) => {
            if (!authenticated) {
              setError('Something went wrong logging in')
            }
          })

          await request.then(() => {
            router.push(response.goto_url || '/login/init')
          })
        } else {
          setError('Invalid response')
        }
      } catch (err) {
        let errorMessage =
          'Something went wrong exchanging the OAuth code for a cookie'

        if (err instanceof ResponseError) {
          const body = await err.response.json()
          if (body['detail']) {
            errorMessage = body['detail']
          }
        }
        setError(errorMessage)
      } finally {
        loading.current = false
      }
    }

    if (code && state) {
      exchange(code, state)
    } else {
      setError('Cannot authenticate without an OAuth code and state')
    }
  }, [code, state, router, session])

  useEffect(() => {
    // Handling GitHub OAuth takes presedence - even if already signed in
    if (loading.current) return

    // This user is already authenticated
    if (session.authenticated) {
      router.push('/login/init')
      return
    }
  }, [session.authenticated, router])

  if (error) {
    return (
      <LoadingScreen animate={false}>
        <LoadingScreenError error={error} />
      </LoadingScreen>
    )
  }

  return (
    <LoadingScreen animate={true}>Brewing a fresh access token</LoadingScreen>
  )
}
