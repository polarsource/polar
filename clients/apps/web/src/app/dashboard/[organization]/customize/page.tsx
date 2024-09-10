import { getServerSideAPI } from '@/utils/api/serverside'
import {
  ArticleVisibility,
  ListResourceArticle,
  ListResourceIssueFunding,
  ListResourceProduct,
  ListResourcePublicDonation,
} from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { ClientPage } from './ClientPage'

import { getOrganizationBySlugOrNotFound } from '@/utils/organization'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()

  let articles: ListResourceArticle | undefined
  let products: ListResourceProduct | undefined
  let listIssueFunding: ListResourceIssueFunding | undefined
  let donations: ListResourcePublicDonation | undefined

  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  try {
    const [loadArticles, loadProducts, loadListIssueFunding, loadDonations] =
      await Promise.all([
        api.articles.list(
          {
            organizationId: organization.id,
            isPublished: true,
            visibility: ArticleVisibility.PUBLIC,
            limit: 3,
          },
          {
            ...cacheConfig,
            next: {
              ...cacheConfig.next,
              tags: [`articles:${organization.id}`],
            },
          },
        ),
        api.products.list(
          {
            organizationId: organization.id,
            isArchived: false,
          },
          {
            ...cacheConfig,
            next: {
              ...cacheConfig.next,
              tags: [`products:${organization.id}`],
            },
          },
        ),
        api.funding.search(
          {
            organizationId: organization.id,
            limit: 10,
            page: 1,
            closed: false,
            sorting: [
              'most_funded',
              'most_recently_funded',
              'most_engagement',
              'newest',
            ],
          },
          {
            ...cacheConfig,
            next: {
              ...cacheConfig.next,
              tags: [`funding:${organization.id}`],
            },
          },
        ),
        api.donations.donationsPublicSearch(
          {
            organizationId: organization.id,
            limit: 5,
          },
          {
            ...cacheConfig,
            next: {
              ...cacheConfig.next,
              tags: [`donations:${organization.id}`],
            },
          },
        ),
      ])

    articles = loadArticles
    products = loadProducts
    listIssueFunding = loadListIssueFunding
    donations = loadDonations
  } catch (e) {
    notFound()
  }

  const posts = articles?.items ?? []

  return (
    <ClientPage
      organization={organization}
      posts={posts}
      products={products.items}
      issues={listIssueFunding.items}
      donations={donations.items}
    />
  )
}
