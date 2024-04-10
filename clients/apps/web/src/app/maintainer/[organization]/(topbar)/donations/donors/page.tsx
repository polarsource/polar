import { redirect } from 'next/navigation'

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  redirect(`/maintainer/${params.organization}/donations/overview`)
}
