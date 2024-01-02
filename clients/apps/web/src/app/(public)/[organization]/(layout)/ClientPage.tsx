'use client'

import { Post as PostComponent } from '@/components/Feed/Posts/Post'
import { Modal, ModalHeader } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import Spinner from '@/components/Shared/Spinner'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { useAuth } from '@/hooks'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { RssIcon } from '@heroicons/react/24/outline'
import { ArrowForwardOutlined } from '@mui/icons-material'
import {
  Article,
  CreatePersonalAccessTokenResponse,
  Organization,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit/api'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CopyToClipboardInput,
  ShadowBoxOnMd,
} from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { useEffect, useMemo, useState } from 'react'

const ClientPage = ({
  organization,
  posts,
}: {
  organization: Organization
  posts: Article[]
}) => {
  const {
    isShown: rssModalIsShown,
    hide: hideRssModal,
    show: showRssModal,
  } = useModal()

  const { data: subscriptionTiers } = useSubscriptionTiers(organization.name)
  const highlightedTiers = useMemo(
    () => subscriptionTiers?.items?.filter((tier) => tier.is_highlighted),
    [subscriptionTiers],
  )

  return isFeatureEnabled('feed') ? (
    <div className="flex flex-row gap-x-16">
      <StaggerReveal className="flex w-full max-w-xl flex-grow flex-col gap-y-6">
        {posts.map((post) => (
          <StaggerReveal.Child key={post.id}>
            <PostComponent article={post} />
          </StaggerReveal.Child>
        ))}
      </StaggerReveal>

      <div className="sticky top-32 flex max-w-[300px] flex-shrink flex-col gap-y-12 self-start">
        {(highlightedTiers?.length ?? 0) > 0 && (
          <div className="flex flex-col justify-start gap-y-6">
            <div className="flex flex-col gap-y-2">
              <h3>Featured Subscriptions</h3>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Support {organization.name} with a paid subsciption & receive
                unique benefits as a bonus
              </p>
            </div>
            <div className="flex flex-col gap-y-4">
              {highlightedTiers?.map((tier) => (
                <Card key={tier.id} className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between p-6 pb-0">
                    <div className="flex flex-row gap-x-2">
                      <SubscriptionGroupIcon
                        className="text-[20px]"
                        type={tier.type}
                      />
                      <h3 className="font-medium">{tier.name}</h3>
                    </div>
                    <div>
                      ${getCentsInDollarString(tier.price_amount, false, true)}
                    </div>
                  </CardHeader>
                  <CardContent className="dark:text-polar-400 px-6 py-4 text-sm text-gray-600">
                    {tier.description}
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Link
                      className="flex flex-row items-center gap-x-2 text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                      href={`/${organization.name}/subscriptions`}
                    >
                      <span className="text-sm">Subscribe</span>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
            <div className="flex flex-row items-center justify-end">
              <Link
                className="flex flex-row items-center gap-x-2 text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                href={`/${organization.name}/subscriptions`}
              >
                <span className="text-sm">View More</span>
                <ArrowForwardOutlined fontSize="inherit" />
              </Link>
            </div>
          </div>
        )}
        <div className="flex flex-col justify-start gap-y-6">
          <div className="flex flex-col gap-y-2">
            <h3>RSS Feed</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Consume posts from {organization.name} in your favorite RSS reader
            </p>
            <Button
              className="flex flex-row self-start p-0 text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={showRssModal}
              variant="ghost"
            >
              <RssIcon className="h-4 w-4" />
              <span className="ml-2 text-sm">Generate RSS Link</span>
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isShown={rssModalIsShown}
        hide={hideRssModal}
        modalContent={
          <RssModal hide={hideRssModal} organization={organization} />
        }
      />
    </div>
  ) : (
    <ShadowBoxOnMd>
      <div className="p-4">
        <div className="flex flex-row items-start justify-between pb-8">
          <h2 className="text-lg font-medium">Issues looking for funding</h2>
        </div>
        <IssuesLookingForFunding organization={organization} />
      </div>
    </ShadowBoxOnMd>
  )
}

export default ClientPage

const RssModal = ({
  hide,
  organization,
}: {
  hide: () => void
  organization: Organization
}) => {
  const { currentUser } = useAuth()
  const [token, setToken] = useState<string>()
  const auth = token ? `?auth=${token}` : ''
  const url = `https://polar.sh/${organization.name}/rss${auth}`

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let active = true

    api.personalAccessToken
      .create({
        createPersonalAccessToken: {
          comment: `RSS for ${organization.name}`,
          scopes: ['articles:read'],
        },
      })
      .then((res: CreatePersonalAccessTokenResponse) => {
        if (active) {
          setToken(res.token)
        }
      })

    return () => {
      active = false
    }
  }, [currentUser])

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          Subscribe to {organization.pretty_name || organization.name} via RSS
        </h3>
      </ModalHeader>
      <div className="p-8">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <span className="font-medium">
              {currentUser ? 'Your feed URL' : 'Feed URL'}
            </span>
            {currentUser ? (
              <p className="text-polar-500 dark:text-polar-500 text-sm">
                This URL is personal, keep it safe.
              </p>
            ) : null}
          </div>

          {url ? (
            <div className="flex items-center gap-2">
              <CopyToClipboardInput value={url} id={'rssurl'} />
              <Link href={`feed:${url}`}>
                <Button asChild>Open</Button>
              </Link>
            </div>
          ) : (
            <Spinner />
          )}
        </div>
      </div>
    </>
  )
}
