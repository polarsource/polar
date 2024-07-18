'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { useIsOrganizationMember } from '@/hooks'
import { useListArticles } from '@/hooks/queries'
import { organizationPageLink } from '@/utils/nav'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { StickyNote2Outlined } from '@mui/icons-material'
import {
  Article,
  ArticleVisibility,
  ListResourceArticle,
  Organization,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

const ClientPage = ({
  organization,
  pinnedArticles,
  articles,
}: {
  organization: Organization
  pinnedArticles: ListResourceArticle
  articles: ListResourceArticle
}) => {
  useTrafficRecordPageView({ organization })

  const isMember = useIsOrganizationMember(organization)
  const posts = useListArticles({
    organizationId: organization.id,
    isPublished: true,
    visibility: ArticleVisibility.PUBLIC,
  })
  const infinitePosts =
    posts.data?.pages
      .flatMap((page) => page.items)
      .filter((item): item is Article => Boolean(item)) ??
    // Fallback to server side loaded articles
    articles.items ??
    []

  const [inViewRef, inView] = useInView()

  useEffect(() => {
    if (inView && posts.hasNextPage) {
      posts.fetchNextPage()
    }
  }, [inView, posts])

  if (!organization.feature_settings?.articles_enabled) {
    return redirect(organizationPageLink(organization))
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <div className="flex w-full flex-col gap-y-16">
        {(pinnedArticles.items?.length ?? 0) > 0 ? (
          <div className="flex w-full flex-col gap-y-6">
            {pinnedArticles.items?.map((post) => (
              <PostComponent article={post} key={post.id} highlightPinned />
            ))}
          </div>
        ) : null}

        {infinitePosts.length > 0 ? (
          <div className="flex w-full flex-col gap-y-6">
            {infinitePosts.map((post) => (
              <PostComponent article={post} key={post.id} />
            ))}
            <div ref={inViewRef} />
          </div>
        ) : (
          <>
            {posts.isFetched &&
            infinitePosts.length === 0 &&
            (pinnedArticles.items?.length ?? 0) === 0 ? (
              <div className="dark:text-polar-400 flex h-full w-full flex-col items-center gap-y-4 pt-32 text-gray-600">
                <StickyNote2Outlined fontSize="large" />
                <div className="flex w-full flex-col items-center gap-y-2 px-12 text-center">
                  {isMember ? (
                    <>
                      <h3 className="p-2 text-lg font-medium">
                        {organization.slug} is typing...
                      </h3>
                      <p className="dark:text-polar-500 w-full min-w-0 text-gray-500">
                        Start building a community & newsletter by writing your
                        first post – your hello world on Polar
                      </p>
                      <Link
                        className="mt-6"
                        href={`/maintainer/${organization.slug}/posts/new`}
                      >
                        <Button>Write a Post</Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <h3 className="p-2 text-lg font-medium">
                        {organization.slug} is typing...
                      </h3>
                      <p className="dark:text-polar-500 w-full min-w-0 text-gray-500">
                        Subscribe to {organization.slug} to get future posts
                        fresh out of the press.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default ClientPage
