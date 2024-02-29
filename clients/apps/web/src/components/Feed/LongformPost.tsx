'use client'

import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { organizationPageLink } from '@/utils/nav'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import { Avatar, Button } from 'polarkit/components/ui/atoms'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import SubscribeNowWithModal from '../Subscriptions/SubscribeNowWithModal'
import BrowserRender from './Markdown/BrowserRender'
import { RenderArticle } from './Markdown/markdown'
import PostPaywall from './PostPaywall'
import Share from './Posts/Share'

const defaultStaggerTransition = {
  staggerChildren: 0.2,
}

const defaultRevealTransition = {
  duration: 1,
}

interface LongformPostProps {
  article: RenderArticle
  staggerTransition?: typeof defaultStaggerTransition
  revealTransition?: typeof defaultRevealTransition
  showPaywalledContent: boolean
  isSubscriber: boolean
  hasPaidArticlesBenefit: boolean
  paidArticlesBenefitName?: string
  animation: boolean
  showShare: boolean
  isAuthor: boolean
}

export default function LongformPost({
  article,
  staggerTransition,
  revealTransition,
  showPaywalledContent,
  isSubscriber,
  hasPaidArticlesBenefit,
  paidArticlesBenefitName,
  animation,
  showShare,
  isAuthor,
}: LongformPostProps) {
  const shouldRenderPaywall = article.is_preview

  const showNonSubscriberUpsell =
    !isAuthor && !isSubscriber && !shouldRenderPaywall

  const showSubscriberUpsell =
    !isAuthor &&
    isSubscriber &&
    !hasPaidArticlesBenefit &&
    !showNonSubscriberUpsell &&
    !shouldRenderPaywall

  staggerTransition = staggerTransition ?? defaultStaggerTransition
  revealTransition = revealTransition ?? defaultRevealTransition

  const noAnimationVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0,
      },
    },
  }

  // Use downstream defaults if animation is enabled
  const animationVariants = animation ? {} : noAnimationVariants

  const publishedDate = useMemo(
    () => (article.published_at ? new Date(article.published_at) : undefined),
    [article],
  )
  const publishedDateText = useMemo(
    () =>
      publishedDate
        ? new Date() > publishedDate
          ? publishedDate.toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : `Scheduled on ${publishedDate.toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}`
        : 'Unpublished',
    [publishedDate],
  )

  return (
    <StaggerReveal
      as="article"
      className="w-full max-w-2xl"
      transition={staggerTransition}
      variants={animationVariants}
    >
      <header className="flex flex-col items-center gap-y-8 pb-4 md:pb-16 md:pt-4">
        <StaggerReveal.Child
          transition={revealTransition}
          variants={animationVariants}
          className="hidden md:flex"
        >
          <LogoIcon className="text-blue-500 dark:text-blue-400" size={40} />
        </StaggerReveal.Child>
        <StaggerReveal.Child
          transition={revealTransition}
          variants={animationVariants}
        >
          <time
            className="dark:text-polar-500 text-gray-500"
            dateTime={publishedDate?.toISOString()}
          >
            {publishedDateText}
          </time>
        </StaggerReveal.Child>
        <StaggerReveal.Child
          transition={revealTransition}
          variants={animationVariants}
        >
          <h1 className="text-center text-2xl !font-semibold !leading-relaxed [text-wrap:balance] md:text-3xl lg:text-4xl">
            {article.title}
          </h1>
        </StaggerReveal.Child>
        <StaggerReveal.Child
          transition={revealTransition}
          variants={animationVariants}
          className="flex flex-col items-center gap-1"
        >
          <div className="flex flex-row items-center gap-x-3">
            <Avatar
              className="h-8 w-8"
              avatar_url={article.byline.avatar_url}
              name={article.byline.name}
            />
            <h3 className="text-md dark:text-polar-50">
              {article.byline.name}
            </h3>
          </div>
        </StaggerReveal.Child>
      </header>

      <StaggerReveal.Child
        transition={revealTransition}
        variants={animationVariants}
      >
        <div
          className={twMerge(
            'prose dark:prose-invert',
            'dark:prose-pre:bg-polar-800 prose-pre:bg-gray-100 prose-pre:rounded-2xl',
            'dark:prose-headings:text-polar-50 prose-p:text-gray-800 dark:prose-p:text-polar-200 dark:prose-strong:text-polar-50 dark:prose-strong:font-medium',
            'prose-img:rounded-2xl prose-img:drop-shadow-none lg:prose-img:drop-shadow-2xl',
            ' prose-a:text-blue-500 hover:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-a:text-blue-400 prose-a:no-underline',
            'prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 dark:prose-code:bg-polar-700 prose-code:font-normal prose-code:rounded-sm prose-code:px-1.5 prose-code:py-1',
            'mb-8 w-full max-w-none space-y-16 leading-loose tracking-[0.015rem]',
          )}
        >
          <BrowserRender
            article={article}
            showPaywalledContent={showPaywalledContent}
            isSubscriber={isSubscriber}
            paidArticlesBenefitName={paidArticlesBenefitName}
          />
        </div>
      </StaggerReveal.Child>

      <footer>
        {shouldRenderPaywall && (
          <StaggerReveal.Child
            transition={revealTransition}
            variants={animationVariants}
          >
            <PostPaywall article={article} isSubscriber={isSubscriber} />
          </StaggerReveal.Child>
        )}

        {showNonSubscriberUpsell ? (
          <UpsellNonSubscriber article={article} />
        ) : null}

        {showSubscriberUpsell ? (
          <UpsellFreeSubscriberToPaid article={article} />
        ) : null}

        {showShare ? <Share className="my-8 flex" article={article} /> : null}
      </footer>
    </StaggerReveal>
  )
}

const UpsellNonSubscriber = ({ article }: { article: RenderArticle }) => (
  <div className="flex flex-col gap-y-16">
    <div className="dark:bg-polar-800 flex flex-col items-center gap-y-6 rounded-3xl bg-gray-100 p-8 py-12 md:px-16 ">
      <Avatar
        className="h-12 w-12"
        avatar_url={article.organization.avatar_url}
        name={article.organization.pretty_name || article.organization.name}
      />
      <h2 className="text-center text-xl font-medium">
        Subscribe to{' '}
        {article.organization.pretty_name || article.organization.name}
      </h2>
      <p className="dark:text-polar-300 text-center text-gray-500">
        {article.organization?.bio
          ? article.organization?.bio
          : `Support ${
              article.organization.pretty_name || article.organization.name
            } by subscribing to their work and get access to exclusive content.`}
      </p>

      <SubscribeNowWithModal
        organization={article.organization}
        isSubscriber={false}
      >
        Subscribe
      </SubscribeNowWithModal>
    </div>
  </div>
)

const UpsellFreeSubscriberToPaid = ({
  article,
}: {
  article: RenderArticle
}) => (
  <div className="flex flex-col gap-y-16">
    <div className="dark:bg-polar-800 flex flex-col items-center gap-y-6 rounded-3xl bg-gray-100 p-8 py-12 md:px-16 ">
      <Avatar
        className="h-12 w-12"
        avatar_url={article.organization.avatar_url}
        name={article.organization.pretty_name || article.organization.name}
      />
      <h2 className="text-xl font-medium">
        Upgrade your subscription to{' '}
        {article.organization.pretty_name || article.organization.name}
      </h2>
      <p className="dark:text-polar-300 text-center text-gray-500">
        {article.organization?.bio
          ? article.organization?.bio
          : `Support ${
              article.organization.pretty_name || article.organization.name
            } by subscribing to their work and get access to exclusive content.`}
      </p>
      <Link href={organizationPageLink(article.organization, 'subscriptions')}>
        <Button className="mt-4">Upgrade</Button>
      </Link>
    </div>
  </div>
)
