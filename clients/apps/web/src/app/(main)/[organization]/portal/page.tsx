import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ [key: string]: string }>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI()
  await getOrganizationOrNotFound(api, params.organization, searchParams)

  redirect(
    `/${params.organization}/portal/overview?${new URLSearchParams(searchParams)}`,
  )
}
