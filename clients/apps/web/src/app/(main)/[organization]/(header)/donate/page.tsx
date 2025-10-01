import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `Donate to ${organization.name}`, // " | Polar is added by the template"
    description: `Donate to ${organization.name}`,
    openGraph: {
      title: `Donate to ${organization.name}`,
      description: `Donate to ${organization.name}`,
      siteName: 'Polar',
      type: 'website',
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `Donate to ${organization.name}`,
        },
      ],
      card: 'summary_large_image',
      title: `Donate to ${organization.name}`,
      description: `Donate to ${organization.name}`,
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization, donation_product } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )
  if (donation_product) {
    redirect(`/${organization.slug}/products/${donation_product.id}`)
  }
  notFound()
}
