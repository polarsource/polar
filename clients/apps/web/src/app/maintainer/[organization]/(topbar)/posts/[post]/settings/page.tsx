import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `${params.organization}`, // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; post: string }
}) {
  const api = getServerSideAPI()

  const article = await api.articles.lookup({
    platform: Platforms.GITHUB,
    organizationName: params.organization,
    slug: params.post as string,
  })

  return <ClientPage article={article} />
}
