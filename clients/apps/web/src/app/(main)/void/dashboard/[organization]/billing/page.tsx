import { redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const { organization } = await props.params
  redirect(`/void/dashboard/${organization}/billing/subscriptions`)
}
