import CheckoutProductInfo from '@/components/Checkout/CheckoutProductInfo'
import { getServerSideAPI } from '@/utils/api/serverside'
import { isCrawler } from '@/utils/crawlers'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { CheckoutPublic } from '@polar-sh/sdk'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { organization: string; productId: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )
  const product = products.find((p) => p.id === params.productId)

  if (!product) {
    notFound()
  }

  return {
    title: `${product.name} by ${organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `${product.name}`,
      description: `A product from ${organization.name}`,
      siteName: 'Polar',
      type: 'website',
      images: [
        {
          url:
            product.medias[0]?.public_url ??
            `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url:
            product.medias[0]?.public_url ??
            `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${product.name}`,
        },
      ],
      card: 'summary_large_image',
      title: `${product.name}`,
      description: `A product from ${organization.name}`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; productId: string }
}) {
  const api = getServerSideAPI()
  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )
  const product = products.find((p) => p.id === params.productId)

  if (!product) {
    notFound()
  }

  /* Avoid creating a checkout for crawlers, just render a simple product info page */
  const headersList = headers()
  const userAgent = headersList.get('user-agent')
  if (userAgent && isCrawler(userAgent)) {
    return <CheckoutProductInfo organization={organization} product={product} />
  }

  let checkout: CheckoutPublic
  try {
    checkout = await api.checkouts.clientCreate({
      body: {
        product_price_id: product.prices[0].id,
      },
    })
  } catch (err) {
    throw err
  }

  return <ClientPage checkout={checkout} organization={organization} />
}
