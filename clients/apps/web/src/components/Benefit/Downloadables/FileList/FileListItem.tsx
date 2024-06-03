import { useDeleteFile } from '@/hooks/queries'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AudioFileOutlined,
  DescriptionOutlined,
  FolderZipOutlined,
  ImageOutlined,
  InsertDriveFileOutlined,
  MoreVertOutlined,
  VideoFileOutlined,
} from '@mui/icons-material'
import { FileRead } from '@polar-sh/sdk'
import { Switch } from 'polarkit/components/ui/atoms'
import { FormEventHandler, useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { usePatchFile } from '@/hooks/queries'

import { FileObject } from '@/components/FileUpload'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import { useMemo } from 'react'

const FilePreview = ({ file }: { file: FileObject }) => {
  const icon = useMemo(() => {
    const size: 'small' | 'large' | 'inherit' | 'medium' = 'small'

    switch (true) {
      case /image\/(.*)/.test(file.mime_type):
        return <ImageOutlined fontSize={size} />
      case /video\/(.*)/.test(file.mime_type):
        return <VideoFileOutlined fontSize={size} />
      case /audio\/(.*)/.test(file.mime_type):
        return <AudioFileOutlined fontSize={size} />
      case /application\/zip/.test(file.mime_type):
        return <FolderZipOutlined fontSize={size} />
      case /application\/pdf/.test(file.mime_type):
        return <DescriptionOutlined fontSize={size} />
      default:
        return <InsertDriveFileOutlined fontSize={size} />
    }
  }, [file])

  return (
    <div className="dark:bg-polar-600 dark:text-polar-50 flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-full bg-blue-50 text-blue-500">
      {icon}
    </div>
  )
}

const FileUploadProgress = ({ file }: { file: FileObject }) => {
  const pct = Math.round((file.uploadedBytes / file.size) * 100)
  return (
    <>
      <div className="flex w-full items-center space-x-4">
        <div className="flex-grow">
          <div className="h-2 w-full rounded bg-gray-100">
            <div
              className="h-2 rounded bg-blue-400"
              style={{ width: `${pct}%` }}
            >
              &nbsp;
            </div>
          </div>
        </div>
        <div className="flex w-8">
          <p className="text-sm">{pct}%</p>
        </div>
      </div>
    </>
  )
}

const Editable = ({
  className,
  children,
  enabled,
  onUpdate,
}: {
  className?: string
  children: React.ReactNode
  enabled: boolean
  onUpdate: (updated: string) => void
}) => {
  const paragraphRef = useRef<HTMLParagraphElement>(null)

  const [isDirty, setIsDirty] = useState(false)

  const update = useCallback(
    (updated: string) => {
      if (isDirty) {
        onUpdate(updated)
      }
    },
    [onUpdate, isDirty],
  )

  const onBlur: FormEventHandler<HTMLParagraphElement> = useCallback(
    (e) => {
      if (!paragraphRef.current) return
      setIsDirty(false)
      const updated = (e.target as HTMLParagraphElement).innerText ?? ''
      update(updated)
    },
    [update],
  )

  const onEditableChanged: FormEventHandler<HTMLParagraphElement> = () => {
    if (!paragraphRef.current) return
    setIsDirty(true)
  }

  return (
    <>
      <p
        ref={paragraphRef}
        className={className}
        suppressContentEditableWarning
        contentEditable={enabled}
        onBlur={onBlur}
        onKeyDown={(e) => {
          onEditableChanged(e)
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        }}
      >
        {children}
      </p>
    </>
  )
}

const FileUploadDetails = ({ file }: { file: FileObject }) => {
  return (
    <div className="dark:text-polar-500 text-gray-500">
      <p className="text-xs">{file.size_readable}</p>
    </div>
  )
}

export const FileListItem = ({
  file,
  updateFile,
  removeFile,
  archivedFiles,
  setArchivedFile,
  sortable,
}: {
  file: FileObject
  updateFile: (callback: (prev: FileObject) => FileObject) => void
  removeFile: () => void
  archivedFiles: { [key: string]: boolean }
  setArchivedFile: (fileId: string, disabled: boolean) => void
  sortable?: ReturnType<typeof useSortable>
}) => {
  // Re-introduce later for editing files, e.g version and perhaps even name?
  const patchFileQuery = usePatchFile(file.id, (response: FileRead) => {
    updateFile((prev: FileObject) => {
      return {
        ...prev,
        ...response,
      }
    })
  })

  const patchFile = useCallback(
    async (attrs: { name?: string; version?: string }) => {
      await patchFileQuery.mutateAsync(attrs)
    },
    [patchFileQuery],
  )

  const {
    isShown: isDeleteShown,
    show: showDeleteModal,
    hide: hideDeleteModal,
  } = useModal()

  const deleteFile = useDeleteFile(file.id, () => {
    removeFile()
  })

  const onToggleEnabled = useCallback(
    (enabled: boolean) => {
      setArchivedFile(file.id, !enabled)
    },
    [file, setArchivedFile],
  )

  const onDelete = useCallback(async () => {
    deleteFile.mutateAsync()
  }, [deleteFile])

  const onCopySHA = useCallback(() => {
    navigator.clipboard.writeText(file.checksum_sha256_hex ?? '')
  }, [file])

  const isUploading = useMemo(() => file.isUploading, [file])

  let isEnabled = useMemo(() => {
    return archivedFiles ? !archivedFiles[file.id] : true
  }, [archivedFiles, file])

  const update = useCallback(
    (attrs: { name?: string; version?: string }) => {
      patchFile(attrs)
    },
    [patchFile],
  )

  return (
    <div
      ref={sortable ? sortable.setNodeRef : undefined}
      className={twMerge(
        'dark:hover:bg-polar-700 dark:text-polar-500 hover:bg-gray-75 flex flex-row items-center justify-between gap-x-8 gap-y-2 rounded-xl px-4 py-2 text-gray-500 transition-colors',
        sortable?.isDragging && 'opacity-30',
      )}
      style={
        sortable
          ? {
              transform: CSS.Transform.toString(sortable.transform),
              transition: sortable.transition,
            }
          : {}
      }
    >
      <div className="flex w-full min-w-0 flex-row items-center gap-x-4">
        <div
          className="cursor-grab"
          ref={sortable ? sortable.setDraggableNodeRef : undefined}
          {...sortable?.attributes}
          {...sortable?.listeners}
        >
          <FilePreview file={file} />
        </div>
        <div className="dark:text-polar-50 flex w-full min-w-0 flex-grow flex-col gap-y-1 text-gray-950">
          <Editable
            className="w-full truncate text-sm font-medium"
            onUpdate={(updated) => update({ name: updated })}
            enabled={file.is_uploaded ?? false}
          >
            {file.name}
          </Editable>
          {!isUploading && <FileUploadDetails file={file} />}
          {isUploading && <FileUploadProgress file={file} />}
        </div>
      </div>
      {!isUploading && (
        <div className="flex w-fit flex-row items-center gap-x-2">
          <Switch checked={isEnabled} onCheckedChange={onToggleEnabled} />
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
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
              <DropdownMenuItem onClick={onCopySHA}>
                Copy SHA256 Checksum
              </DropdownMenuItem>
              <DropdownMenuItem onClick={showDeleteModal}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ConfirmModal
        isShown={isDeleteShown}
        hide={hideDeleteModal}
        title="Delete File Download"
        description="Deleting a file from a benefit is permanent & will revoke access for granted customers. Are you sure?"
        onConfirm={onDelete}
        destructive
      />
    </div>
  )
}

export const DraggableFileListItem = ({
  file,
  updateFile,
  removeFile,
  archivedFiles,
  setArchivedFile,
}: {
  file: FileObject
  updateFile: (callback: (prev: FileObject) => FileObject) => void
  removeFile: () => void
  archivedFiles: { [key: string]: boolean }
  setArchivedFile: (fileId: string, disabled: boolean) => void
}) => {
  const sortable = useSortable({ id: file.id })

  return (
    <FileListItem
      file={file}
      updateFile={updateFile}
      removeFile={removeFile}
      archivedFiles={archivedFiles}
      setArchivedFile={setArchivedFile}
      sortable={sortable}
    />
  )
}
