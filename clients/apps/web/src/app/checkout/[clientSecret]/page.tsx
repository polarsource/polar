import { Checkout } from '@/components/Checkout/Checkout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getCheckoutByClientSecret } from '@/utils/checkout'
import { getOrganizationById } from '@/utils/organization'
import { CheckoutStatus } from '@polar-sh/sdk'
import { notFound, redirect } from 'next/navigation'

export async function generateMetadata({
  params: { clientSecret },
}: {
  params: { clientSecret: string }
}) {
  const api = getServerSideAPI()

  const checkout = await getCheckoutByClientSecret(api, clientSecret)

  if (!checkout) {
    notFound()
  }

  return {
    title: `Checkout | ${checkout.product.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `Checkout | ${checkout.product.name}`,
      siteName: 'Polar',
      images: [
        {
          url: checkout.product.medias[0]?.public_url,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: checkout.product.medias[0]?.public_url,
          width: 1200,
          height: 630,
          alt: `${checkout.product.name}`,
        },
      ],
      card: 'summary_large_image',
      title: `Checkout | ${checkout.product.name}`,
    },
  }
}

export default async function Page({
  params: { clientSecret },
}: {
  params: { clientSecret: string }
}) {
  const api = getServerSideAPI()

  const checkout = await getCheckoutByClientSecret(api, clientSecret)

  if (checkout.status !== CheckoutStatus.OPEN) {
    redirect(checkout.success_url)
  }

  const organization = await getOrganizationById(
    api,
    checkout.product.organization_id,
  )
  return <Checkout organization={organization} checkout={checkout} />
}
