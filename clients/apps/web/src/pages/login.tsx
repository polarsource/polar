import Login from '@/components/Auth/Login'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useAuth } from '../hooks'

const Page: NextLayoutComponentType = (props: { gotoUrl?: string }) => {
  const { currentUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (currentUser) {
      router.push('/dashboard')
      return
    }
  }, [currentUser, router])

  return (
    <>
      <Head>
        <title>Polar</title>
      </Head>
      <Login gotoUrl={props.gotoUrl} />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <div>{page}</div>
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (typeof context?.query?.goto_url !== 'string') {
    return { props: {} }
  }

  return {
    props: {
      gotoUrl: context.query.goto_url,
    },
  }
}

export default Page
