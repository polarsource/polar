import { redirect } from 'next/navigation'

export default function GatewayPage({
  params,
}: {
  params: { organization: string }
}) {
  return redirect(`/dashboard/${params.organization}/gateway/overview`)
}
