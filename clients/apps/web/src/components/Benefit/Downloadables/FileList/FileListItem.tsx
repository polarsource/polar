import { useDeleteFile } from '@/hooks/queries'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AudioFileOutlined from '@mui/icons-material/AudioFileOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import FolderZipOutlined from '@mui/icons-material/FolderZipOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import VideoFileOutlined from '@mui/icons-material/VideoFileOutlined'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import {
  FocusEvent,
  FormEventHandler,
  useCallback,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

import { usePatchFile } from '@/hooks/queries'

import { FileObject } from '@/components/FileUpload'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useMemo } from 'react'

export const FilePreview = ({ mimeType }: { mimeType: string }) => {
  const icon = useMemo(() => {
    const size: 'small' | 'large' | 'inherit' | 'medium' = 'small'

    switch (true) {
      case /image\/(.*)/.test(mimeType):
        return <ImageOutlined fontSize={size} />
      case /video\/(.*)/.test(mimeType):
        return <VideoFileOutlined fontSize={size} />
      case /audio\/(.*)/.test(mimeType):
        return <AudioFileOutlined fontSize={size} />
      case /application\/zip/.test(mimeType):
        return <FolderZipOutlined fontSize={size} />
      case /application\/pdf/.test(mimeType):
        return <DescriptionOutlined fontSize={size} />
      default:
        return <InsertDriveFileOutlined fontSize={size} />
    }
  }, [mimeType])

  return (
    <div className="dark:bg-polar-700 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-white text-blue-500 dark:text-white">
      {icon}
    </div>
  )
}

const FileUploadProgress = ({ file }: { file: FileObject }) => {
  const pct = Math.round((file.uploadedBytes / file.size) * 100)
  return (
    <>
      <div className="flex w-full items-center space-x-4">
        <div className="grow">
          <div className="dark:bg-polar-700 h-2 w-full rounded-sm bg-gray-200">
            <div
              className="h-2 rounded-sm bg-blue-400"
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

const FilenameEditor = ({
  name,
  className,
  enabled,
  onUpdate,
}: {
  name: string
  className?: string
  enabled: boolean
  onUpdate: (updated: string) => void
}) => {
  const paragraphRef = useRef<HTMLParagraphElement>(null)

  const [isDirty, setIsDirty] = useState(false)

  // Mimic macOS behavior when editing a filename.
  // Highlighting everything except extension.
  const selectNameBeforeExtension = (e: FocusEvent<HTMLParagraphElement>) => {
    const range = document.createRange()
    const textNode = e.target.firstChild
    if (!textNode) return

    const text = e.target.innerText
    range.setStart(textNode, 0)

    const extensionIndex = text.lastIndexOf('.')
    const ending = extensionIndex > 0 ? extensionIndex : text.length
    range.setEnd(textNode, ending)

    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

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
      <div className={twMerge('flex flex-row', className)}>
        <p
          ref={paragraphRef}
          suppressContentEditableWarning
          contentEditable={enabled}
          onFocus={(e) => {
            selectNameBeforeExtension(e)
          }}
          onBlur={onBlur}
          onKeyDown={(e) => {
            onEditableChanged(e)
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        >
          {name}
        </p>
      </div>
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
  const patchFileQuery = usePatchFile(file.id, (response) => {
    updateFile((prev: FileObject) => {
      return {
        ...prev,
        ...response,
      }
    })
  })

  const patchFile = useCallback(
    async (attrs: { name?: string; version?: string }) => {
      await patchFileQuery.mutateAsync(attrs).then((result) => {
        if (result.error) {
          toast({
            title: 'File Update Failed',
            description: `Error updating file ${file.name}: ${result.error.detail}`,
          })
          return
        }
        toast({
          title: 'File Updated',
          description: `File ${file.name} updated successfully`,
        })
      })
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
    deleteFile.mutateAsync().then((response) => {
      if (response.error) {
        toast({
          title: 'File Deletion Failed',
          description: `Error deleting file ${file.name}: ${response.error.detail}`,
        })
        return
      }
      toast({
        title: 'File Deleted',
        description: `File ${file.name} deleted successfully`,
      })
    })
  }, [deleteFile])

  const onCopySHA = useCallback(() => {
    navigator.clipboard.writeText(file.checksum_sha256_hex ?? '')
  }, [file])

  const isUploading = useMemo(() => file.isUploading, [file])

  const isEnabled = useMemo(() => {
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
        'dark:bg-polar-800 dark:text-polar-500 mb-2 flex flex-row items-center justify-between gap-x-8 gap-y-2 rounded-xl bg-gray-100 p-3 text-gray-500 transition-colors',
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
          <FilePreview mimeType={file.mime_type} />
        </div>
        <div className="flex w-full min-w-0 grow flex-col gap-y-1 text-gray-950 dark:text-white">
          <FilenameEditor
            name={file.name}
            className="text-sm font-medium"
            onUpdate={(updated) => update({ name: updated })}
            enabled={file.is_uploaded ?? false}
          />
          {!isUploading && <FileUploadDetails file={file} />}
          {isUploading && <FileUploadProgress file={file} />}
        </div>
      </div>
      {!isUploading && (
        <div className="flex w-fit flex-row items-center gap-x-2">
          <Switch checked={isEnabled} onCheckedChange={onToggleEnabled} />
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
              {file.checksum_sha256_hex && (
                <>
                  <DropdownMenuItem onClick={onCopySHA}>
                    Copy SHA256 Checksum
                  </DropdownMenuItem>
                </>
              )}
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
