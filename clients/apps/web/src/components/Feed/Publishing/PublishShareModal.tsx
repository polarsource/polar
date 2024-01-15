import { Modal } from '@/components/Modal'
import { CloseOutlined } from '@mui/icons-material'
import { Article } from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'
import { useMemo } from 'react'

export interface PublishShareModalProps {
  article: Article
  isShown: boolean
  hide: () => void
}

export const PublishShareModal = ({
  article,
  isShown,
  hide,
}: PublishShareModalProps) => {
  console.log(article)

  const url = useMemo(
    () => `https://polar.sh/${article.organization.name}/posts/${article.slug}`,
    [article],
  )

  return (
    <Modal
      isShown={isShown}
      hide={hide}
      modalContent={
        <div className="relative flex flex-col items-center justify-center gap-y-12 p-12">
          <div
            className="dark:text-polar-100 dark:hover:text-polar-300 absolute right-6 top-6 cursor-pointer text-black hover:text-gray-800"
            onClick={hide}
          >
            <CloseOutlined />
          </div>
          <div className="flex flex-col items-center gap-y-6">
            <LogoIcon className="h-12 w-12 text-blue-500 dark:text-blue-400" />
            <div className="flex flex-col items-center gap-y-2 text-center">
              <h2 className="dark:text-polar-50 text-xl font-medium text-gray-950">
                Your post was successfully published!
              </h2>
              <p className="dark:text-polar-500 text-gray-500">
                Let the world know about it
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-y-2">
            <Link
              className="w-full"
              target="_blank"
              href={`https://news.ycombinator.com/submitlink?u=${url}&t=${encodeURIComponent(
                article.title,
              )}`}
            >
              <Button fullWidth>Share to Hacker News</Button>
            </Link>

            <Link
              className="w-full"
              target="_blank"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                article.title,
              )}&url=${encodeURIComponent(url)}`}
            >
              <Button variant="secondary" fullWidth>
                Share to X / Twitter
              </Button>
            </Link>
            <Link
              className="w-full"
              target="_blank"
              href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(
                article.title,
              )} ${url}`}
            >
              <Button variant="secondary" fullWidth>
                Share to LinkedIn
              </Button>
            </Link>
          </div>
        </div>
      }
    />
  )
}
