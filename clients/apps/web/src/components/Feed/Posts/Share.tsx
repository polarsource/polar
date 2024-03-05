import { LinkedIn } from '@mui/icons-material'
import XIcon from '@mui/icons-material/X'
import { organizationPageLink } from 'polarkit/utils/nav'

import { Article } from '@polar-sh/sdk'

import { Button } from 'polarkit/components/ui/atoms'
import { useOutsideClick } from 'polarkit/utils'
import React, { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export type ShareArticle = Pick<Article, 'title' | 'organization' | 'slug'>

const HackerNews = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 448 512"
    className={className}
  >
    <path
      fill="currentColor"
      d="M0 32v448h448V32H0zm21.2 197.2H21c.1-.1.2-.3.3-.4 0 .1 0 .3-.1.4zm218 53.9V384h-31.4V281.3L128 128h37.3c52.5 98.3 49.2 101.2 59.3 125.6 12.3-27 5.8-24.4 60.6-125.6H320l-80.8 155.1z"
    />
  </svg>
)

export const Share = ({
  className,
  article,
}: {
  className?: string
  article: ShareArticle
}) => {
  const classNames = twMerge('relative', className)

  const [isOpen, setOpen] = useState<boolean>(false)

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const url = organizationPageLink(
    article.organization,
    `posts/${article.slug}`,
  )

  return (
    <>
      <div className={classNames}>
        <Button variant={'secondary'} onClick={() => setOpen(true)}>
          Share
        </Button>

        {isOpen && (
          <div
            ref={ref}
            className={twMerge(
              'dark:bg-polar-800 dark:text-polar-400 dark:border-polar-700 absolute left-0 top-12 z-50 w-[300px] overflow-hidden rounded-2xl bg-white p-2 shadow-xl dark:border',
            )}
          >
            <LinkItem
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                article.title,
              )}&url=${encodeURIComponent(url)}`}
              icon={<XIcon className="h-6 w-6 text-black" />}
            >
              <>X / Twitter</>
            </LinkItem>

            <LinkItem
              href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(
                article.title,
              )} ${url}`}
              icon={<LinkedIn className="h-6 w-6 text-black" />}
            >
              <>LinkedIn</>
            </LinkItem>

            <LinkItem
              href={`https://news.ycombinator.com/submitlink?u=${url}&t=${encodeURIComponent(
                article.title,
              )}`}
              icon={<HackerNews className="h-6 w-6 text-black" />}
            >
              <>Hacker News</>
            </LinkItem>
          </div>
        )}
      </div>
    </>
  )
}

const ListItem = (props: {
  children: React.ReactElement
  current: boolean
  className?: string
}) => {
  const className = twMerge(
    'animate-background duration-10 flex items-center gap-2 py-2 px-4 w-full rounded-lg transition-colors',
    props.current
      ? 'bg-blue-50 dark:bg-polar-700 text-blue-500 dark:text-blue-50'
      : 'hover:text-blue-500 dark:hover:text-polar-50',
    props.className ?? '',
  )

  return <li className={className}>{props.children}</li>
}

const LinkItem = (props: {
  href: string
  icon?: React.ReactElement
  children: React.ReactElement
}) => {
  return (
    <a href={props.href} target="_blank" rel="noopener noreferrer">
      <ListItem current={false} className="rounded-lg px-6">
        <div className="flex flex-row items-center gap-x-3 text-sm">
          <span className="text-lg">{props.icon}</span>
          {props.children}
        </div>
      </ListItem>
    </a>
  )
}

export default Share
