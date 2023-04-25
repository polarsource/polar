import type { NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAuth } from '../hooks'

const Home: NextPage = () => {
  const { currentUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (currentUser) {
      router.push('/dashboard')
      return
    }
  }, [currentUser])

  return (
    <>
      <Head>
        <title>Polar</title>
      </Head>
    </>
  )
}

export default Home
