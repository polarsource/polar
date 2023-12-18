'use client'

import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { useEffect, useState } from 'react'

export default function Page() {
  const [token, setToken] = useState<string>()
  const router = useRouter()

  useEffect(() => {
    api.users
      .createToken()
      .then((response) => {
        if (response.token) {
          setToken(response.token)
        }
      })
      .catch((error) => {
        if (error.status === 401) {
          router.push('/?return_to=/settings/extension')
        }
      })
  }, [router])

  return (
    <>
      <div id="polar-token" style={{ color: 'white' }}>
        {token}
      </div>

      <LoadingScreen>
        <>One second, creating a connection...</>
      </LoadingScreen>
    </>
  )
}
