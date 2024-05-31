import { BenefitDownloadablesSubscriber, DownloadableRead } from '@polar-sh/sdk'

import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import { useDownloadables } from '@/hooks/queries'
import { ArrowDownward } from '@mui/icons-material'
import { useRef } from 'react'
import { useHoverDirty } from 'react-use'

const DownloadableItem = ({
  downloadable,
  historic,
}: {
  downloadable: DownloadableRead
  historic: boolean
}) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const isHovered = useHoverDirty(ref)

  return (
    <a
      ref={ref}
      className="flex w-full flex-row items-center justify-between gap-x-6"
      href={downloadable.file.download.url}
      download
    >
      <div className="flex w-full flex-col gap-y-1">
        <span className="min-w-0 truncate text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
          {downloadable.file.name}
        </span>
        <span className="dark:text-polar-500 text-xs text-gray-500">
          {downloadable.file.size_readable}
        </span>
      </div>
      <AnimatedIconButton
        className="hidden md:flex"
        active={isHovered}
        variant="secondary"
        direction="vertical"
      >
        <ArrowDownward fontSize="inherit" />
      </AnimatedIconButton>
    </a>
  )
}

const DownloadablesSubscriberWidget = ({
  benefit,
}: {
  benefit: BenefitDownloadablesSubscriber
}) => {
  const downloadablesQuery = useDownloadables(
    benefit.id,
    benefit.properties.active_files,
  )

  let activeLookup: { [key: string]: boolean } = {}
  benefit.properties.active_files.reduce((acc, fileId: string) => {
    acc[fileId] = true
    return acc
  }, activeLookup)

  const downloadables = downloadablesQuery.data?.items

  if (downloadablesQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  return (
    <div className="flex w-full flex-col">
      <ul className="flex w-full flex-col gap-y-4">
        {downloadables?.map((downloadable) => (
          <li key={downloadable.id} className="flex w-full flex-col">
            <DownloadableItem
              downloadable={downloadable}
              historic={!activeLookup[downloadable.file.id]}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DownloadablesSubscriberWidget
