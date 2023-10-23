'use client'

import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks'
import { ResponseError } from '@polar-sh/sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from 'polarkit'
import { useEffect, useRef, useState } from 'react'

export default function Page() {
  const searchParams = useSearchParams()
  const token = searchParams ? searchParams.get('token') : null
  const router = useRouter()
  const session = useAuth()
  const [error, setError] = useState<string | null>(null)
  const loading = useRef(false)

  const authenticate = async () => {
    if (loading.current) {
      return
    }

    if (!token) {
      router.replace('/login')
      return
    }

    loading.current = true
    try {
      const response = await api.magicLink.authenticateMagicLink({ token })
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
      if (err instanceof ResponseError) {
        if (err.response.status == 401) {
          setError((await err.response.json())['detail'])
        }
      }
    } finally {
      loading.current = false
    }
  }

  useEffect(() => {
    authenticate()
  }, [])

  return (
    <LoadingScreen animate={!error}>
      {!error && 'Brewing a fresh access token'}
      {error && <LoadingScreenError error={error} />}
    </LoadingScreen>
  )
}
