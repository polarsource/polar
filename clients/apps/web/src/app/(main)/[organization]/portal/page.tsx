import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import { redirect } from 'next/navigation'

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const api = getServerSideAPI()
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

  console.log(sp.toString())

  redirect(`/${params.organization}/portal/overview?${sp.toString()}`)
}
