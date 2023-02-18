import type { NextPage } from 'next'

import { QueryDemo } from 'polar-react-kit'

const LoginPage: NextPage = ({ query }) => {
  return (
    <>
      <h1 className="text-3xl font-bold underline mt-10">Signin</h1>
      <QueryDemo />
    </>
  )
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default LoginPage
