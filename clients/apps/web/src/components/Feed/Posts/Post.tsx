'use client'

import { ArrowForward, LanguageOutlined } from '@mui/icons-material'
import { Article } from '@polar-sh/sdk'
import { motion, useSpring, useTransform } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, Button } from 'polarkit/components/ui/atoms'
import { ButtonProps } from 'polarkit/components/ui/button'
import { PropsWithChildren, useCallback, useEffect, useRef } from 'react'
import { useHoverDirty } from 'react-use'
import { twMerge } from 'tailwind-merge'

type FeedPost = { article: Article }

export const Post = (props: FeedPost) => {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useHoverDirty(ref)

  const router = useRouter()
  const onClick = () => {
    router.push(
      `/${props.article.organization.name}/posts/${props.article.slug}`,
    )
  }

  return (
    <div
      className="dark:border-polar-800 hover:dark:bg-polar-800/50 dark:bg-polar-900 flex w-full cursor-pointer flex-row justify-start gap-x-4 rounded-3xl border border-gray-100 bg-white px-6 pb-6 pt-8 shadow-sm transition-all duration-100"
      ref={ref}
      onClick={onClick}
    >
      <Avatar
        className="h-10 w-10"
        avatar_url={props.article.byline.avatar_url}
        name={props.article.byline.name}
      />
      <div className="flex w-full min-w-0 flex-col">
        <PostHeader {...props} isHovered={isHovered} />
        <PostBody {...props} isHovered={isHovered} />
      </div>
    </div>
  )
}

const PostHeader = (props: FeedPos & { isHovered: boolean }) => {
  return (
    <div className="flex w-full flex-row items-center justify-between text-sm">
      <div className="flex flex-col">
        <div className="dark:text-polar-400 flex flex-row flex-nowrap items-center gap-x-2 text-gray-500 ">
          <Link
            className="flex min-w-0 flex-grow flex-row items-center gap-x-2 truncate"
            href={`/${props.article.organization.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-blue-500 dark:text-blue-400">
              {props.article.organization.pretty_name ||
                props.article.organization.name}
            </h3>
          </Link>
        </div>
        <div className="dark:text-polar-400 flex flex-row items-center gap-x-2 text-gray-500">
          {props.article.published_at ? (
            <>
              <div className="min-w-0 flex-shrink flex-nowrap truncate text-xs">
                {new Date(props.article.published_at).toLocaleString('en-US', {
                  year:
                    new Date(props.article.published_at).getFullYear() ===
                    new Date().getFullYear()
                      ? undefined
                      : 'numeric',
                  month:
                    new Date(props.article.published_at).getFullYear() ===
                    new Date().getFullYear()
                      ? 'long'
                      : 'short',
                  day: 'numeric',
                })}
              </div>
            </>
          ) : null}
          &middot;
          {props.article.visibility === 'public' ? (
            <>
              <div className="flex flex-row items-center gap-x-1">
                <span className="flex items-center text-blue-500">
                  <LanguageOutlined fontSize="inherit" />
                </span>
                <span className="text-xs">Public</span>
              </div>
              &middot;
            </>
          ) : (
            <>
              <div className="flex flex-row items-center gap-x-1">
                <span className="text-xs capitalize">
                  {props.article.visibility}
                </span>
              </div>
              &middot;
            </>
          )}
          <Link
            onClick={(e) => e.stopPropagation()}
            href={`/${props.article.organization.name}?tab=subscriptions`}
          >
            <Button className="px-0" variant="link" size="sm">
              Subscribe
            </Button>
          </Link>
        </div>
      </div>
      <AnimatedIconButton active={props.isHovered} variant="secondary">
        <ArrowForward fontSize="inherit" />
      </AnimatedIconButton>
    </div>
  )
}

const PostBody = (props: FeedPost & { isHovered: boolean }) => {
  return (
    <div
      className={twMerge(
        'flex w-full flex-col gap-y-4 pb-5 pt-2 text-[15px] leading-relaxed transition-colors duration-200',
      )}
    >
      <Link
        className="dark:text-polar-50 flex flex-col flex-wrap pt-2 text-lg font-medium text-gray-950"
        href={`/${props.article.organization.name}/posts/${props.article.slug}`}
      >
        {props.article.title}
      </Link>
      <div className="flex flex-col flex-wrap">
        <p
          className={twMerge(
            'text-md line-clamp-4 w-full flex-wrap truncate whitespace-break-spaces break-words leading-loose text-gray-500',
            props.isHovered
              ? 'dark:text-polar-300 text-gray-800'
              : 'dark:text-polar-400 text-gray-700',
          )}
        >
          {props.article.body.replace('\n\n', '\n')}
        </p>
      </div>
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
