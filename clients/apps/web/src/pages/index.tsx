import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useAuth } from 'polarkit/hooks'
import { useEffect } from 'react'

const Home: NextPage = () => {
  const { currentUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (currentUser) {
      router.push('/dashboard')
      return
    }
  }, [currentUser])

  return <></>
}

export default Home
