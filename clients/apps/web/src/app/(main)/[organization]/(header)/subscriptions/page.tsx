import { redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  redirect(`/${params.organization}`)
}
