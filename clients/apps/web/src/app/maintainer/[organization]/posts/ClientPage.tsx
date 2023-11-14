'use client'

import { AnimatedIconButton } from '@/components/Feed/Post'
import { posts } from '@/components/Feed/data'
import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { EyeIcon } from '@heroicons/react/24/outline'
import {
  ArrowForward,
  ChatBubbleOutline,
  LanguageOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { PolarTimeAgo } from 'polarkit/components/ui/atoms'

const ClientPage = () => {
  // Get current org & repo from URL
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()

  const postsToRender = posts.filter(
    (post) => post.author.username === currentOrg?.name,
  )

  return (
    <>
      <DashboardBody>
        <div className="items flex flex-row items-start gap-x-12">
          <div className="flex w-2/3 flex-col gap-y-12">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg text-gray-950">
                Overview
              </h3>
            </div>
            <div className="flex w-full flex-col gap-y-6">
              {postsToRender.map((post, index) => (
                <Link
                  key={index}
                  href={`/maintainer/${currentOrg?.name}/posts/123`}
                >
                  <div className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-row justify-between rounded-2xl border border-gray-100 bg-white p-8 transition-colors">
                    <div className="flex w-full flex-col gap-y-6">
                      <div className="flex w-full flex-col gap-y-2">
                        <h3 className="text-md dark:text-polar-50 font-medium text-gray-950">
                          This is a post
                        </h3>
                        <p className="dark:text-polar-500 min-w-0 truncate text-gray-400">
                          {post.text}
                        </p>
                      </div>
                      <div className="flex flex-row items-center justify-between">
                        <div className="dark:text-polar-300 flex w-full flex-row gap-x-3 text-sm text-gray-600">
                          <PolarTimeAgo date={post.createdAt} />
                          &middot;
                          {post.visibility !== 'public' ? (
                            <div className="flex flex-row items-center gap-x-2 text-sm">
                              <SubscriptionGroupIcon type={post.visibility} />
                              <span className="capitalize">
                                {post.visibility}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-row items-center gap-x-2 text-sm">
                              <LanguageOutlined fontSize="small" />
                              <span className="capitalize">
                                {post.visibility}
                              </span>
                            </div>
                          )}
                          &middot;
                          <div className="flex flex-row items-center gap-x-2 text-sm">
                            <EyeIcon className="h-4 w-4" />
                            <span>
                              {Math.round(Math.random() * 100)}k Impressions
                            </span>
                          </div>
                          &middot;
                          <div className="flex flex-row items-center gap-x-2 text-sm">
                            <ChatBubbleOutline fontSize="inherit" />
                            <span>
                              {Math.round(Math.random() * 100)} Comments
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-row items-center gap-x-2">
                          <AnimatedIconButton
                            children={<ArrowForward fontSize="inherit" />}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
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
