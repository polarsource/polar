import { useDeleteFile } from '@/hooks/queries'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragIndicatorOutlined } from '@mui/icons-material'
import { FileRead } from '@polar-sh/sdk'
import { Switch } from 'polarkit/components/ui/atoms'
import { Card } from 'polarkit/components/ui/atoms/card'
import { FormEventHandler, useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { usePatchFile } from '@/hooks/queries'

import { FileObject } from '@/components/FileUpload'

function formatBytes(bytes: number) {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return new Intl.NumberFormat('en-US', {
    style: 'unit',
    unit: units[i].toLowerCase(),
    unitDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(bytes / Math.pow(k, i))
}

const FilePreview = ({ file }: { file: FileObject }) => {
  return (
    <div className="h-14 w-14 rounded bg-gray-200 text-gray-600">
      <p className="font-semibold">.{file.extension}</p>
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
  children,
  enabled,
  onUpdate,
}: {
  children: React.ReactNode
  enabled: boolean
  onUpdate: (updated: string) => void
}) => {
  const paragraphRef = useRef<HTMLParagraphElement>(null)

  const [isDirty, setIsDirty] = useState(false)

  const update = useCallback(
    (updated) => {
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
        className="font-semibold"
        suppressContentEditableWarning={true}
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

const FileDetails = ({
  file,
  patchFile,
}: {
  file: FileObject
  patchFile: (attrs: { name?: string; version?: string }) => void
}) => {
  const update = (attrs: { name?: string; version?: string }) => {
    patchFile(attrs)
  }

  return (
    <>
      <Editable
        onUpdate={(updated) => update({ name: updated })}
        enabled={file.is_uploaded}
      >
        {file.name}
      </Editable>
      {!file.isUploading && (
        <div className="text-gray-500">
          <p className="text-xs">
            <span className="font-medium">Size:</span> {file.size}
          </p>
          <p className="text-xs">
            <span className="font-medium">SHA-256:</span>{' '}
            {file.checksum_sha256_hex}
          </p>
          <label>Version:</label>
          <Editable
            onUpdate={(updated) => update({ version: updated })}
            enabled={file.is_uploaded}
          >
            {file.version}
          </Editable>
        </div>
      )}
    </>
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

  const patchFile = async (attrs: { name?: string; version?: string }) => {
    await patchFileQuery.mutateAsync(attrs)
  }

  const deleteFile = useDeleteFile(file.id, () => {
    removeFile()
  })

  const onToggleEnabled = (enabled: boolean) => {
    setArchivedFile(file.id, !enabled)
  }

  const onDelete = async () => {
    deleteFile.mutateAsync()
  }

  const isUploading = file.isUploading

  let isEnabled = true
  if (archivedFiles && archivedFiles[file.id]) {
    isEnabled = !archivedFiles[file.id]
  }

  return (
    <Card
      ref={sortable ? sortable.setNodeRef : undefined}
      className={twMerge(
        'dark:text-polar-500 transition-color dark:hover:text-polar-300 dark:hover:bg-polar-800 transition-color mb-4 flex items-center gap-y-2 space-x-4 rounded text-gray-500 hover:bg-gray-50 hover:text-gray-600',
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
      <div className="flex w-14 text-center">
        <FilePreview file={file} />
      </div>
      <div className="flex-grow text-gray-700">
        <FileDetails file={file} patchFile={patchFile} />
        {isUploading && <FileUploadProgress file={file} />}
      </div>
      {!isUploading && (
        <div className="flex w-14">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              onDelete()
            }}
          >
            x
          </a>
          <Switch checked={isEnabled} onCheckedChange={onToggleEnabled} />

          <span
            ref={sortable ? sortable.setDraggableNodeRef : undefined}
            className="cursor-grab"
            {...sortable?.attributes}
            {...sortable?.listeners}
          >
            <DragIndicatorOutlined
              className={twMerge('dark:text-polar-600 text-gray-400')}
              fontSize="small"
            />
          </span>
        </div>
      )}
    </Card>
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
