import { useCustomerDownloadables } from '@/hooks/queries'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { FilePreview } from './FileList/FileListItem'

export const DownloadableItem = ({
  className,
  downloadable,
  historic,
  showActions = true,
  fileIcon,
}: {
  className?: string
  downloadable: schemas['DownloadableRead']
  historic: boolean
  showActions?: boolean
  fileIcon?: boolean
}) => {
  const onCopySHA = useCallback(() => {
    navigator.clipboard.writeText(downloadable.file.checksum_sha256_hex ?? '')
  }, [downloadable])

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex w-full flex-row items-center justify-between gap-x-6 rounded-2xl bg-gray-50 px-4 py-3',
        className,
      )}
    >
      <div className="flex w-full min-w-0 shrink flex-row items-center gap-x-4">
        {fileIcon && <FilePreview mimeType={downloadable.file.mime_type} />}
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
      </div>
      <div className="flex flex-row items-center gap-x-2">
        {showActions && (
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
        )}
        <a
          className="flex flex-row items-center gap-x-2"
          href={downloadable.file.download.url}
          download
        >
          <Button size="icon">
            <ArrowDownward fontSize="inherit" />
          </Button>
        </a>
      </div>
    </div>
  )
}

const DownloadablesBenefitGrant = ({
  api,
  benefitGrant,
}: {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrantDownloadables']
}) => {
  const {
    benefit: {
      properties: { active_files },
    },
  } = benefitGrant
  const { data: downloadables, isLoading } = useCustomerDownloadables(api, {
    benefit_id: benefitGrant.benefit.id,
  })

  const sortedDownloadables = useMemo(() => {
    if (!downloadables) return []
    return downloadables.items.sort((a, b) => {
      if (
        active_files.includes(a.file.id) &&
        !active_files.includes(b.file.id)
      ) {
        return -1
      }
      if (
        !active_files.includes(a.file.id) &&
        active_files.includes(b.file.id)
      ) {
        return 1
      }
      return active_files.indexOf(a.file.id) - active_files.indexOf(b.file.id)
    })
  }, [downloadables, active_files])

  if (isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  return (
    <div className="flex w-full flex-col">
      <ul className="flex w-full flex-col gap-y-4">
        {sortedDownloadables.map((downloadable) => (
          <li key={downloadable.id} className="flex w-full flex-col">
            <DownloadableItem
              downloadable={downloadable}
              historic={!active_files.includes(downloadable.file.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DownloadablesBenefitGrant
