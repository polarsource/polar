import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import type { Metadata } from 'next'
import AppPage from './AppPage'

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
    title: `${organization.name}`, // " | Spaire is added by the template"
    description: `${organization.name} on Spaire`,
    openGraph: {
      title: `${organization.name} on Spaire`,
      description: `${organization.name} on Spaire`,
      siteName: 'Spaire',
      type: 'website',
      images: [
        {
          url: `https://spairehq.com/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://spairehq.com/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${organization.name} on Spaire`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} on Spaire`,
      description: `${organization.name} on Spaire`,
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  return <AppPage organization={organization} products={products} />
}
