import Login from '@/components/Auth/Login'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useListOrganizations } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useAuth } from '../hooks'

const Page: NextLayoutComponentType = (props: { gotoUrl?: string }) => {
  const { currentUser } = useAuth()
  const listOrganizationsQuery = useListOrganizations()
  const router = useRouter()
  const orgs = listOrganizationsQuery?.data?.items

  useEffect(() => {
    if (!listOrganizationsQuery.isFetched) return
    if (!currentUser) return

    // redirect to first org
    if (orgs && orgs.length > 0) {
      const gotoOrg = orgs[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    }

    // user have no orgs, send to /feed
    router.push('/feed')
  }, [listOrganizationsQuery, orgs, router])

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
