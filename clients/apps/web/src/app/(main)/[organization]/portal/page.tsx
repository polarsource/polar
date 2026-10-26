import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ [key: string]: string }>
}) {
  const [searchParams, params, api] = await Promise.all([
    props.searchParams,
    props.params,
    getServerSideAPI(),
  ])
  await getOrganizationOrNotFound(api, params.organization, searchParams)

  redirect(
    `/${params.organization}/portal/overview?${new URLSearchParams(searchParams)}`,
  )
}
