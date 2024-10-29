import { getServerSideAPI } from '@/utils/api/serverside'
import { ResponseError, WebhookEndpoint } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import {
  BreadcrumbPageParams,
  BreadcrumbSeparator,
  CopyableBreadcrumbLink,
} from '../../../../Breadcrumb'

export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams & { id: string }
}) {
  const api = await getServerSideAPI()

  let webhook: WebhookEndpoint
  try {
    webhook = await api.webhooks.getWebhookEndpoint({ id: params.id })
  } catch (err) {
    if (err instanceof ResponseError && err.response.status === 404) {
      notFound()
    }
    throw err
  }

  return (
    <>
      <BreadcrumbSeparator />
      <CopyableBreadcrumbLink
        href={`/dashboard/${params.organization}/settings/webhooks/endpoints/${webhook.id}`}
        text={webhook.id}
      >
        Webhook {webhook.id}
      </CopyableBreadcrumbLink>
    </>
  )
}
