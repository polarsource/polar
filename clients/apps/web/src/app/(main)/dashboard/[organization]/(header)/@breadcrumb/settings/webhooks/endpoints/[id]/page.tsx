import { getServerSideAPI } from '@/utils/client/serverside'
import { unwrap } from '@polar-sh/client'
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
  const webhook = await unwrap(
    api.GET('/v1/webhooks/endpoints/{id}', {
      params: {
        path: {
          id: params.id,
        },
      },
    }),
    {
      404: notFound,
    },
  )

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
