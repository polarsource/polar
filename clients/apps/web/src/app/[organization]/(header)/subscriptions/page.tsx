import { redirect } from 'next/navigation'

export default async function Page({
  params,
}: {
  params: { organization: string; }
}) {
  redirect(`/${params.organization}`)
}
