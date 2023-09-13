'use client'

import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { ApiError } from 'polarkit/api'
import { useCallback, useEffect, useState } from 'react'

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const token = searchParams.token as string | undefined
  const router = useRouter()
  const session = useAuth()
  const [error, setError] = useState<string | null>(null)

  const authenticate = useCallback(async () => {
    if (!token) {
      router.replace('/login')
    } else {
      try {
        const response = await api.magicLink.authenticateMagicLink({ token })
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
        if (err instanceof ApiError) {
          if (err.status == 401) {
            setError(err.body.detail)
          }
        }
      }
    }
  }, [token, router, session])

  useEffect(() => {
    authenticate()
  }, [])

  return (
    <LoadingScreen animate={!error}>
      {!error && 'Brewing a fresh access token.'}
      {error && <LoadingScreenError error={error} />}
    </LoadingScreen>
  )
}
