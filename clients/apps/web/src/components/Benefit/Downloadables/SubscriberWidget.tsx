import { BenefitDownloadablesSubscriber, DownloadableRead } from '@polar-sh/sdk'

import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import { useDownloadables } from '@/hooks/queries'
import { ArrowDownward, MoreVertOutlined } from '@mui/icons-material'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useCallback, useRef } from 'react'
import { useHoverDirty } from 'react-use'

export const DownloadableItem = ({
  downloadable,
  historic,
}: {
  downloadable: DownloadableRead
  historic: boolean
}) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const isHovered = useHoverDirty(ref)

  const onCopySHA = useCallback(() => {
    navigator.clipboard.writeText(downloadable.file.checksum_sha256_hex ?? '')
  }, [downloadable])

  return (
    <div className="flex w-full flex-row items-center justify-between gap-x-6">
      <div className="flex w-full min-w-0 flex-col gap-y-1">
        <span className="min-w-0 truncate text-sm">
          {downloadable.file.name}
        </span>
        <div className="flex flex-row items-center gap-x-2 text-xs">
          <span className="dark:text-polar-500 text-gray-500">
            {downloadable.file.size_readable}
          </span>
          {historic && (
            <Pill className="text-xxs" color="gray">
              Legacy
            </Pill>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center gap-x-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none" asChild>
            <Button
              className={
                'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
              size="icon"
              variant="secondary"
            >
              <MoreVertOutlined fontSize="inherit" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="dark:bg-polar-800 bg-gray-50 shadow-lg"
          >
            {downloadable.file.checksum_sha256_hex && (
              <>
                <DropdownMenuItem onClick={onCopySHA}>
                  Copy SHA256 Checksum
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <a
          ref={ref}
          className="flex flex-row items-center gap-x-2"
          href={downloadable.file.download.url}
          download
        >
          <AnimatedIconButton
            className="hidden md:flex"
            active={isHovered}
            variant="secondary"
            direction="vertical"
          >
            <ArrowDownward fontSize="inherit" />
          </AnimatedIconButton>
        </a>
      </div>
    </div>
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
