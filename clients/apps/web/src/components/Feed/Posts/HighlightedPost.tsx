import { firstImageUrlFromMarkdown } from '@/utils/markdown'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Article } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useMemo } from 'react'
import PreviewText from '../Markdown/preview'

export interface HighlightedPostProps {
  post: Article
}

export const HighlightedPost = ({ post }: HighlightedPostProps) => {
  const image =
    post.og_image_url ??
    firstImageUrlFromMarkdown(post.body) ??
    `/og?articleId=${post.id}`

  const publishedDate = useMemo(
    () => (post.published_at ? new Date(post.published_at) : undefined),
    [post],
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
    <Link
      className="group flex flex-col gap-y-8"
      href={organizationPageLink(post.organization, `posts/${post.slug}`)}
    >
      {image && (
        <div
          className="aspect-video w-full rounded-3xl bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
      <header className="flex flex-col items-center gap-y-4">
        <time
          className="dark:text-polar-500 text-gray-500"
          dateTime={publishedDate?.toISOString()}
        >
          {publishedDateText}
        </time>
        <h1 className="text-center text-2xl !font-semibold !leading-relaxed [text-wrap:balance] md:text-3xl">
          {post.title}
        </h1>
        <p className="dark:text-polar-500 dark:group-hover:text-polar-200 line-clamp-2 max-w-2xl text-center leading-loose text-gray-500 transition-colors duration-500 [text-wrap:pretty] group-hover:text-gray-800">
          {post.og_description ?? <PreviewText article={post} />}
        </p>
        <Button variant="ghost">
          Read
          <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
        </Button>
      </header>
    </Link>
  )
}
