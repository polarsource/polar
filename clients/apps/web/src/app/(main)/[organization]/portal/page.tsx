import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI()
  await getOrganizationOrNotFound(api, params.organization)

  const sp = new URLSearchParams(
    Object.entries(searchParams ?? {}).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: Array.isArray(value) ? value[0] : value,
      }),
      {},
    ),
  )

  redirect(`/${params.organization}/portal/overview?${sp.toString()}`)
}
