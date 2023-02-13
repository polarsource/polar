import type { NextPage } from 'next'
import { useEffect } from 'react'
import { client } from 'lib/api'

const LoginPage: NextPage = ({ query }) => {
  useEffect(() => {
    if (
      typeof window !== undefined &&
      query.provider === 'github' &&
      query.code &&
      query.state
    ) {
      console.log('Called login')
      client.integrations
        .githubCallback({
          code: query.code,
          state: query.state,
        })
        .then((res) => {
          if (res.authenticated) {
            window.location.replace('/dashboard')
          }
        })
    }
  }, [])
  return (
    <>
      <h1 className="text-3xl font-bold underline mt-10">Signin</h1>
      <p>{JSON.stringify(query)}</p>
    </>
  )
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default LoginPage
