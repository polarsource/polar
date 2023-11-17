'use client'

import {
  ArrowForward,
  BookmarkBorderOutlined,
  ChatBubbleOutline,
  FavoriteBorderOutlined,
  LanguageOutlined,
  MoreVertOutlined,
  VerifiedUser,
} from '@mui/icons-material'
import { motion, useSpring, useTransform } from 'framer-motion'
import Link from 'next/link'
import { Avatar, Button, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { ButtonProps } from 'polarkit/components/ui/button'
import { PropsWithChildren, useCallback, useEffect, useRef } from 'react'
import { useHoverDirty } from 'react-use'
import { twMerge } from 'tailwind-merge'
import SubscriptionGroupIcon from '../../Subscriptions/SubscriptionGroupIcon'
import { Post as FeedPost } from '../data'
import { PostMeta } from './meta/Meta'

export const Post = (props: FeedPost) => {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useHoverDirty(ref)

  return (
    <div
      ref={ref}
      className={twMerge(
        'relative flex w-full flex-row justify-start gap-x-4 rounded-3xl border px-6 pb-6 pt-8 transition-all duration-100',
        isHovered
          ? 'dark:bg-polar-900 dark:border-polar-800 border-gray-100 bg-white shadow-sm'
          : 'border-transparent bg-transparent dark:border-transparent dark:bg-transparent',
      )}
    >
      <Avatar
        className="h-12 w-12"
        avatar_url={props.author.avatar_url}
        name={props.author.username}
      />
      <div className="flex w-full min-w-0 flex-col">
        <PostHeader {...props} />
        <PostBody {...props} isHovered={isHovered} />
        <PostFooter {...props} isHovered={isHovered} />
      </div>
    </div>
  )
}

const PostHeader = (props: FeedPost) => {
  return (
    <div className="-mt-2 flex w-full flex-row items-center justify-between text-sm">
      <div className="flex flex-row items-center gap-x-2">
        <Link
          className="flex flex-row items-center gap-x-2"
          href={`/${props.author.username}`}
        >
          <h3 className="text-blue-500 dark:text-blue-400">
            {props.author.username}
          </h3>
          {props.author.verified && (
            <VerifiedUser className="text-blue-500" fontSize="inherit" />
          )}
        </Link>
        <div className="dark:text-polar-400 flex flex-row items-center gap-x-2 text-gray-500">
          &middot;
          <div className="text-xs">
            <PolarTimeAgo date={props.createdAt} />
          </div>
          &middot;
          {props.visibility === 'public' && (
            <>
              <div className="flex flex-row items-center gap-x-1">
                <span className="flex items-center text-blue-500">
                  <LanguageOutlined fontSize="inherit" />
                </span>
                <span className="text-xs">Public</span>
              </div>
              &middot;
            </>
          )}
          <Link href={`/${props.author.username}?tab=subscriptions`}>
            <Button className="px-0" variant="link" size="sm">
              Subscribe
            </Button>
          </Link>
        </div>
      </div>
      <div className="dark:text-polar-400 text-base">
        <MoreVertOutlined fontSize="inherit" />
      </div>
    </div>
  )
}

const PostBody = (props: FeedPost & { isHovered: boolean }) => {
  return (
    <div
      className={twMerge(
        'flex w-full flex-col gap-y-4 pb-5 pt-2 text-[15px] leading-relaxed transition-colors duration-200',
        props.isHovered
          ? 'dark:text-polar-300 text-gray-800'
          : 'dark:text-polar-400 text-gray-700',
      )}
    >
      <div className="flex flex-col flex-wrap">{props.text}</div>
      <PostMeta {...props} />
    </div>
  )
}

const PostFooter = (props: FeedPost & { isHovered: boolean }) => {
  return (
    <div className="flex flex-row items-center justify-between gap-x-4">
      <div className="flex flex-row items-center gap-x-4">
        <div className="dark:text-polar-400 dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-x-8 self-start rounded-full border border-gray-100 bg-white px-4 py-1.5 text-sm text-gray-500 shadow-sm">
          <div className="flex cursor-pointer flex-row items-center gap-x-2 hover:text-blue-500">
            <FavoriteBorderOutlined fontSize="inherit" />
            <span>{props.likes.length}</span>
          </div>
          <div className="flex cursor-pointer flex-row items-center gap-x-2 hover:text-blue-500">
            <ChatBubbleOutline fontSize="inherit" />
            <span>{props.likes.length}</span>
          </div>
          <div className="flex cursor-pointer flex-row items-center gap-x-2 hover:text-blue-500">
            <BookmarkBorderOutlined fontSize="inherit" />
            <span>{props.likes.length}</span>
          </div>
        </div>

        {props.visibility !== 'public' ? (
          <div className="dark:text-polar-400 dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-x-1.5 self-start rounded-full border border-gray-100 bg-white px-4 py-1.5 text-sm text-gray-500 shadow-sm">
            <SubscriptionGroupIcon type={props.visibility} />
            <span className="capitalize">{props.visibility}</span>
          </div>
        ) : null}
      </div>
      <AnimatedIconButton active={props.isHovered} variant="secondary">
        <ArrowForward fontSize="inherit" />
      </AnimatedIconButton>
    </div>
  )
}

export const AnimatedIconButton = (
  props: PropsWithChildren<{
    active?: boolean | undefined
    variant?: ButtonProps['variant']
  }>,
) => {
  const x = useSpring(0, { damping: 15, velocity: 5 })
  const incomingX = useTransform(x, [0, 1], [-30, 0], { clamp: false })
  const outgoingX = useTransform(x, [0, 1], [0, 30], { clamp: false })

  useEffect(() => {
    x.set(props.active ? 1 : 0)
  }, [x, props])

  const handleMouse = useCallback(
    (value: number) => () => {
      if (typeof props.active === 'undefined') {
        x.set(value)
      }
    },
    [x, props],
  )

  return (
    <Button
      size="icon"
      variant={props.active ? 'default' : props.variant}
      className="h-8 w-8 overflow-hidden rounded-full"
      onMouseEnter={handleMouse(1)}
      onMouseLeave={handleMouse(0)}
    >
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={{ x: incomingX }}
      >
        {props.children}
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={{ x: outgoingX }}
      >
        {props.children}
      </motion.div>
    </Button>
  )
}
