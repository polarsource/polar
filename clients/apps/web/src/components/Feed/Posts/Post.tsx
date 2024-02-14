'use client'

import { ArrowForward } from '@mui/icons-material'
import { Article } from '@polar-sh/sdk'
import { motion, useSpring, useTransform } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, Button } from 'polarkit/components/ui/atoms'
import { ButtonProps } from 'polarkit/components/ui/button'
import { PropsWithChildren, useCallback, useEffect, useRef } from 'react'
import { useHoverDirty } from 'react-use'
import { twMerge } from 'tailwind-merge'
import { AbbreviatedBrowserRender } from '../Markdown/BrowserRender'

type FeedPost = { article: Article }

const articleHref = (art: Article): string => {
  return `/${art.organization.name}/posts/${art.slug}`
}

export const Post = (props: FeedPost) => {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useHoverDirty(ref)

  const router = useRouter()
  const onClick = () => {
    router.push(articleHref(props.article))
  }

  return (
    <div
      className={twMerge(
        'dark:border-polar-800 hover:dark:bg-polar-800/60 dark:bg-polar-900 flex w-full flex-col justify-start gap-4 rounded-3xl bg-white px-6 pb-6 pt-8 shadow-sm transition-all duration-100 dark:border md:flex-row',
        props.article.paid_subscribers_only &&
          'border border-blue-50 bg-gradient-to-b from-blue-50/80 to-transparent hover:from-blue-100 dark:from-blue-800/20 dark:hover:from-blue-800/30',
        props.article.is_pinned &&
          'border border-green-100 bg-gradient-to-b from-green-100/80 to-transparent hover:from-green-200 dark:from-green-700/20 dark:hover:from-green-600/30',
      )}
      ref={ref}
      onClick={onClick}
      onMouseOver={(e) => {
        // As we're relying on JS to make the whole div clickable. Require JS to use the pointer cursor.
        ;(e.target as HTMLDivElement).classList.add('cursor-pointer')
      }}
      onMouseOut={(e) => {
        ;(e.target as HTMLDivElement).classList.remove('cursor-pointer')
      }}
    >
      <Avatar
        className="hidden h-10 w-10 md:block"
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

const PostHeader = (props: FeedPost & { isHovered: boolean }) => {
  return (
    <div className="flex w-full flex-row items-center gap-x-4 text-sm md:justify-between">
      <Avatar
        className="block h-10 w-10 md:hidden"
        avatar_url={props.article.byline.avatar_url}
        name={props.article.byline.name}
      />
      <div className="flex flex-col gap-y-0.5">
        <div className="dark:text-polar-400 flex flex-row flex-nowrap items-center gap-x-2 text-gray-500 ">
          <Link
            className="flex min-w-0 flex-grow flex-row items-center gap-x-2 truncate"
            href={`/${props.article.organization.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:dark:text-blue-500">
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
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </>
          ) : null}

          {props.article.paid_subscribers_only ? (
            <>
              &middot;
              <div className="flex flex-row items-center rounded-full bg-blue-50 bg-gradient-to-l px-2 dark:bg-blue-950">
                <span className="text-[.6rem] text-blue-300 dark:text-blue-300">
                  Premium
                </span>
              </div>
            </>
          ) : null}

          {props.article.is_pinned ? (
            <>
              &middot;
              <div className="flex flex-row items-center rounded-full bg-green-100 bg-gradient-to-l px-2 dark:bg-green-950">
                <span className="text-[.6rem] text-green-500 dark:text-green-300">
                  Pinned
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <AnimatedIconButton
        className="hidden md:flex"
        active={props.isHovered}
        variant="secondary"
        href={articleHref(props.article)}
      >
        <ArrowForward fontSize="inherit" />
      </AnimatedIconButton>
    </div>
  )
}

const PostBody = (props: FeedPost & { isHovered: boolean }) => {
  return (
    <div
      className={twMerge(
        'flex w-full flex-col gap-y-4 pb-5 pt-4 text-[15px] leading-relaxed md:pt-2',
      )}
    >
      <Link
        className="dark:text-polar-50 hover:dark:text-polar-100 flex flex-col flex-wrap pt-2 text-lg font-medium text-gray-950 hover:text-gray-900"
        href={articleHref(props.article)}
      >
        {props.article.title}
      </Link>
      <div className="flex flex-col flex-wrap">
        <div className="prose prose-headings:first:mt-0 prose-p:first:mt-0 prose-img:first:mt-0 prose-p:last:mb-0 dark:prose-pre:bg-polar-800 prose-pre:bg-gray-100 dark:prose-invert prose-pre:rounded-2xl dark:prose-headings:text-white prose-p:text-gray-700 prose-img:rounded-2xl dark:prose-p:text-polar-200 dark:text-polar-200 prose-a:text-blue-500 hover:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-a:text-blue-400 prose-a:no-underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 dark:prose-code:bg-polar-700 prose-code:font-normal prose-code:rounded-sm prose-code:px-1.5 prose-code:py-1 w-full max-w-none text-gray-600">
          <AbbreviatedBrowserRender article={props.article} />
        </div>
      </div>
    </div>
  )
}
export const AnimatedIconButton = (
  props: PropsWithChildren<{
    className?: string
    active?: boolean | undefined
    variant?: ButtonProps['variant']
    href: string
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
    <Link href={props.href}>
      <Button
        size="icon"
        variant={props.active ? 'default' : props.variant}
        className={twMerge(
          'h-8 w-8 overflow-hidden rounded-full',
          props.className,
        )}
        onMouseEnter={handleMouse(1)}
        onMouseLeave={handleMouse(0)}
        asChild
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
    </Link>
  )
}
