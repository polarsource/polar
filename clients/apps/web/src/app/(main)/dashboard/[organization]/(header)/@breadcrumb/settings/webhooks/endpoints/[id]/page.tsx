import CopyToClipboardButton from '@/components/CopyToClipboardButton/CopyToClipboardButton'
import { getServerSideAPI } from '@/utils/api/serverside'
import {
  BreadcrumbLink,
  BreadcrumbPageParams,
  BreadcrumbSeparator,
} from '../../../../Breadcrumb'

export default async function BreadcrumbPage({
  params,
}: {
  params: BreadcrumbPageParams & { id: string }
}) {
  const api = await getServerSideAPI()
  const webhook = await api.webhooks.getWebhookEndpoint({ id: params.id })
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbLink
        href={`/dashboard/${params.organization}/settings/webhooks/endpoints/${webhook.id}`}
      >
        Webhook {webhook.id}
        <CopyToClipboardButton text={webhook.id} />
      </BreadcrumbLink>
    </>
  )
}
