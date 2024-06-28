import { useDeleteFile } from '@/hooks/queries'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProductMediaFileRead } from '@polar-sh/sdk'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { FileObject } from '@/components/FileUpload'
import { ClearOutlined } from '@mui/icons-material'
import { useMemo } from 'react'

type ProductMediaFileObject = FileObject<ProductMediaFileRead>

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

  const onDelete = useCallback(async () => {
    deleteFile.mutateAsync()
  }, [deleteFile])

  const isUploading = useMemo(() => file.isUploading, [file])

  const imageURL = useMemo(() => {
    if (file.public_url) {
      return file.public_url
    } else if (file.buffer) {
      const blob = new Blob([file.buffer], { type: file.mime_type })
      return URL.createObjectURL(blob)
    }
    return undefined
  }, [file])

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageURL}
        alt={file.name}
        className="relative aspect-square w-full cursor-grab rounded-2xl object-cover"
        ref={sortable ? sortable.setDraggableNodeRef : undefined}
        {...sortable?.attributes}
        {...sortable?.listeners}
      />
      {!isUploading && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white"
        >
          <ClearOutlined fontSize="inherit" />
        </button>
      )}
      {isUploading && (
        <div className="absolute left-0 top-0 h-full w-full bg-black opacity-50"></div>
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
