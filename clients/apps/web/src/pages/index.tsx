import Login from 'components/Auth/Login'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useAuth } from '../hooks'

const Page: NextLayoutComponentType = () => {
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
      <Login />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <div>{page}</div>
}

export default Page
