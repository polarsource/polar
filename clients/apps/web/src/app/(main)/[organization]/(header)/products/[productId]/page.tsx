import { getServerURL } from '@/utils/api'
import { getServerSideAPI } from '@/utils/client/serverside'
import { isCrawler } from '@/utils/crawlers'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import { unwrap } from '@polar-sh/client'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ProductPage from './ProductPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; productId: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
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

export default async function Page(props: {
  params: Promise<{ organization: string; productId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const { products } = await getStorefrontOrNotFound(api, params.organization)
  const product = products.find((p) => p.id === params.productId)

  if (!product) {
    notFound()
  }

  /* Avoid creating a checkout for crawlers */
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  if (userAgent && isCrawler(userAgent)) {
    return <></>
  }

  const checkout = await unwrap(
    api.POST('/v1/checkouts/client/', {
      body: {
        product_id: product.id,
      },
    }),
  )

  return (
    <CheckoutProvider
      clientSecret={checkout.client_secret}
      serverURL={getServerURL()}
    >
      <CheckoutFormProvider>
        <ProductPage />
      </CheckoutFormProvider>
    </CheckoutProvider>
  )
}
