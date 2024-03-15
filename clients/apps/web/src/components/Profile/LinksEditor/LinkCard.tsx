import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DragIndicatorOutlined,
  GitHub,
  LanguageOutlined,
  X,
} from '@mui/icons-material'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Link as LinkItem } from './LinksEditor'

export const LinkCard = ({
  link,
  disabled,
  sortable,
}: {
  link: LinkItem
  disabled?: boolean
  sortable?: ReturnType<typeof useSortable>
}) => {
  const [renderFaviconFallback, setRenderFaviconFallback] = useState(false)
  const url = useMemo(() => {
    try {
      return new URL(link.url)
    } catch (err) {
      return undefined
    }
  }, [link.url])

  const customFavicon = useMemo(() => {
    switch (url?.hostname.replace('www.', '')) {
      case 'x.com':
      case 'twitter.com':
        return <X className="h-6 w-6 text-black dark:text-white" />
      case 'github.com':
        return <GitHub className="h-6 w-6 text-black dark:text-white" />
      case 'polar.sh':
        return <LogoIcon className="h-8 w-8 text-blue-500 dark:text-blue-400" />
      default:
        return undefined
    }
  }, [url])

  const { opengraph } = link

  if (!url) {
    return null
  }

  return (
    <Card
      ref={sortable ? sortable.setNodeRef : undefined}
      style={
        sortable
          ? {
              transform: CSS.Transform.toString(sortable.transform),
              transition: sortable.transition,
            }
          : {}
      }
      className={twMerge(
        'dark:text-polar-500 transition-color dark:hover:text-polar-300 dark:hover:bg-polar-800 transition-color flex flex-col gap-y-2 rounded-3xl text-gray-500 hover:bg-gray-50 hover:text-gray-600',
        sortable?.isDragging && 'opacity-30',
      )}
    >
      <Link
        className="h-full"
        href={link.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <CardHeader className="flex flex-row items-center justify-between p-6">
          {customFavicon ? (
            customFavicon
          ) : opengraph && !renderFaviconFallback ? (
            <img
              className="h-4 w-4"
              width={16}
              height={16}
              src={`https://${url.hostname}/favicon.ico`}
              alt={`Favicon for ${link}`}
              onError={() => setRenderFaviconFallback(true)}
            />
          ) : (
            <LanguageOutlined className="dark:text-polar-600 h-6 w-6 text-gray-400" />
          )}
          {!disabled && (
            <span
              ref={
                disabled || !sortable ? undefined : sortable.setDraggableNodeRef
              }
              className="cursor-grab"
              {...sortable?.attributes}
              {...sortable?.listeners}
            >
              <DragIndicatorOutlined
                className={twMerge('dark:text-polar-600 text-gray-400')}
                fontSize="small"
              />
            </span>
          )}
        </CardHeader>
        <CardContent className="flex h-full grow flex-col flex-wrap gap-y-2 px-6 py-0 pb-2">
          <h3 className="dark:text-polar-50 line-clamp-2 text-gray-950">
            {opengraph?.ogTitle ?? url.hostname.replace('www.', '')}
          </h3>
        </CardContent>
      </Link>
      <CardFooter className="flex flex-row flex-wrap items-center justify-between gap-4 p-6 pt-0">
        {opengraph && (
          <p className="dark:text-polar-500 text-sm text-gray-500">
            {url.hostname.replace('www.', '')}
          </p>
        )}
      </CardFooter>
    </Card>
  )
}

export const DraggableLinkCard = ({
  link,
  disabled,
}: {
  link: LinkItem
  disabled?: boolean
}) => {
  const sortable = useSortable({ id: link.id })

  return <LinkCard sortable={sortable} link={link} disabled={disabled} />
}
