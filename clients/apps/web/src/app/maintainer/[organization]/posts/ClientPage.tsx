'use client'

import { AnimatedIconButton } from '@/components/Feed/Post'
import { Post, posts } from '@/components/Feed/data'
import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { EyeIcon } from '@heroicons/react/24/outline'
import {
  AddOutlined,
  ArrowForward,
  ChatBubbleOutline,
  LanguageOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { Button, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { useMemo, useRef } from 'react'
import { useHoverDirty } from 'react-use'

const ClientPage = () => {
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()

  return (
    <>
      <DashboardBody>
        <div className="items mb-24 flex flex-row items-start gap-x-12">
          <div className="flex w-2/3 flex-col gap-y-12">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg text-gray-950">
                Overview
              </h3>
              <Button className="h-8 w-8 rounded-full">
                <AddOutlined fontSize="inherit" />
              </Button>
            </div>
            <StaggerReveal className="flex w-full flex-col gap-y-4">
              {posts.map((post) => (
                <StaggerReveal.Child key={post.slug}>
                  <PostItem {...post} />
                </StaggerReveal.Child>
              ))}
            </StaggerReveal>
          </div>
          <div className="flex w-1/3 flex-col gap-y-8">
            <div className="flex w-full flex-grow flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg text-gray-950">
                Section Title
              </h3>
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage

const PostItem = (post: Post) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()
  const isHovered = useHoverDirty(ref)

  const impressions = useMemo(() => Math.round(Math.random() * 100), [])
  const comments = useMemo(() => Math.round(Math.random() * 100), [])

  const [title, ...descArray] = post.text.split('.')
  const desc = descArray.join('.')

  return (
    <Link ref={ref} href={`/maintainer/${currentOrg?.name}/posts/${post.slug}`}>
      <div className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-row justify-between rounded-2xl bg-white p-8 shadow-sm transition-colors hover:bg-blue-50/50 dark:border">
        <div className="flex w-full flex-col gap-y-6">
          <div className="flex w-full flex-col gap-y-2">
            <h3 className="text-md dark:text-polar-50 font-medium text-gray-950">
              {title}
            </h3>
            <p className="dark:text-polar-500 min-w-0 truncate text-gray-500">
              {desc}
            </p>
          </div>
          <div className="flex flex-row items-center justify-between">
            <div className="dark:text-polar-300 flex w-full flex-row gap-x-3 text-sm text-gray-500">
              <PolarTimeAgo date={post.createdAt} />
              &middot;
              {post.visibility !== 'public' ? (
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  <SubscriptionGroupIcon type={post.visibility} />
                  <span className="capitalize">{post.visibility}</span>
                </div>
              ) : (
                <div className="flex flex-row items-center gap-x-2 text-sm">
                  <LanguageOutlined fontSize="small" />
                  <span className="capitalize">{post.visibility}</span>
                </div>
              )}
              &middot;
              <div className="flex flex-row items-center gap-x-2 text-sm">
                <EyeIcon className="h-4 w-4" />
                <span>{impressions}k Impressions</span>
              </div>
              &middot;
              <div className="flex flex-row items-center gap-x-2 text-sm">
                <ChatBubbleOutline fontSize="inherit" />
                <span>{comments} Comments</span>
              </div>
            </div>
            <div className="flex flex-row items-center gap-x-4">
              <AnimatedIconButton
                active={isHovered}
                variant="secondary"
                children={<ArrowForward fontSize="inherit" />}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
