import { useDeleteFile } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { twMerge } from 'tailwind-merge'

import { FileObject } from '@/components/FileUpload'
import { toast } from '@/components/Toast/use-toast'
import { ClearOutlined } from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { useCallback, useEffect, useMemo, useRef } from 'react'

type ProductMediaFileObject = FileObject<schemas['ProductMediaFileRead']>

export const FileListItem = ({
  file,
  removeFile,
  sortable,
}: {
  file: ProductMediaFileObject
  removeFile: () => void
  sortable?: ReturnType<typeof useSortable>
}) => {
  const deleteFile = useDeleteFile(file.id, () => {
    removeFile()
  })

  const onDelete = async () => {
    deleteFile
      .mutateAsync()
      .then(() => {
        toast({
          title: 'File Deleted',
          description: `File ${file.name} was deleted successfully`,
        })
      })
      .catch((e) => {
        toast({
          title: 'File Deletion Failed',
          description: `Error deleting file: ${extractApiErrorMessage(e)}`,
        })
      })
  }

  const isUploading = useMemo(() => file.isUploading, [file])

  const imageRef = useRef<HTMLImageElement | null>(null)
  const setDraggableNodeRef = sortable?.setDraggableNodeRef
  const setImageRef = useCallback(
    (node: HTMLImageElement | null) => {
      imageRef.current = node
      setDraggableNodeRef?.(node)
    },
    [setDraggableNodeRef],
  )

  useEffect(() => {
    if (file.public_url || !file.file || !imageRef.current) return
    const objectURL = URL.createObjectURL(file.file)
    imageRef.current.src = objectURL
    return () => URL.revokeObjectURL(objectURL)
  }, [file.public_url, file.file])

  return (
    <div
      ref={sortable ? sortable.setNodeRef : undefined}
      className={twMerge('relative', sortable?.isDragging && 'opacity-30')}
      style={
        sortable
          ? {
              transform: CSS.Transform.toString(sortable.transform),
              transition: sortable.transition,
            }
          : {}
      }
    >
      {/* oxlint-disable-next-line @next/next/no-img-element */}
      <img
        src={file.public_url || undefined}
        alt={file.name}
        className="relative aspect-square w-full cursor-grab rounded-2xl object-cover"
        ref={setImageRef}
        {...sortable?.attributes}
        {...sortable?.listeners}
      />
      {!isUploading && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-0 right-0 flex h-[44px] w-[44px] cursor-pointer items-center justify-center"
        >
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            <ClearOutlined fontSize="inherit" />
          </div>
        </button>
      )}
      {isUploading && (
        <div className="absolute top-0 left-0 h-full w-full bg-black opacity-50" />
      )}
    </div>
  )
}

export const DraggableFileListItem = ({
  file,
  removeFile,
}: {
  file: ProductMediaFileObject
  removeFile: () => void
}) => {
  const sortable = useSortable({ id: file.id })

  return (
    <FileListItem file={file} removeFile={removeFile} sortable={sortable} />
  )
}
