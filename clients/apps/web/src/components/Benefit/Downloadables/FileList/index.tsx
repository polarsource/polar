import { FileObject } from '@/components/FileUpload'
import { useDraggable } from '@/hooks/draggable'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DraggableFileListItem, FileListItem } from './FileListItem'

const PAGE_SIZE = 10

export const FileList = ({
  files,
  setFiles,
  updateFile,
  removeFile,
  archivedFiles,
  setArchivedFile,
}: {
  files: FileObject[]
  setFiles: (callback: (prev: FileObject[]) => FileObject[]) => void
  updateFile: (
    fileId: string,
    callback: (prev: FileObject) => FileObject,
  ) => void
  removeFile: (fileId: string) => void
  archivedFiles: { [key: string]: boolean }
  setArchivedFile: (fileId: string, disabled: boolean) => void
}) => {
  const [currentPage, setCurrentPage] = useState(0)

  const getUpdateScopedFile = (fileId: string) => {
    return (callback: (prev: FileObject) => FileObject) => {
      updateFile(fileId, callback)
    }
  }

  const getRemoveScopedFile = (fileId: string) => {
    return () => removeFile(fileId)
  }

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(
    files,
    (updated) => {
      setFiles(() => updated)
    },
    (_: FileObject[]) => {},
  )

  if (files.length === 0) {
    return <></>
  }

  // Client-side pagination
  const totalPages = Math.ceil(files.length / PAGE_SIZE)
  const startIndex = currentPage * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, files.length)
  const visibleFiles = files.slice(startIndex, endIndex)
  const showPagination = files.length > PAGE_SIZE

  let activeFile = undefined
  if (activeId) {
    activeFile = files.find((file) => file.id === activeId) as FileObject
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={files} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-y-6">
          <div className="-mx-4 flex-row justify-start gap-4 px-4 pb-4 md:mx-0 md:p-0">
            {visibleFiles.map((file) => (
              <DraggableFileListItem
                key={file.id}
                file={file}
                updateFile={getUpdateScopedFile(file.id)}
                removeFile={getRemoveScopedFile(file.id)}
                archivedFiles={archivedFiles}
                setArchivedFile={setArchivedFile}
              />
            ))}
          </div>
          {showPagination && (
            <div className="flex items-center justify-between gap-4">
              <span className="dark:text-polar-500 text-sm text-gray-500">
                {files.length === 1
                  ? 'Viewing the only file'
                  : `Viewing ${startIndex + 1}-${endIndex} of ${files.length}`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="dark:text-polar-400 min-w-[80px] text-center text-sm text-gray-600">
                  {currentPage + 1} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPage >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <DragOverlay adjustScale={true}>
            {activeFile ? (
              <FileListItem
                file={activeFile}
                updateFile={getUpdateScopedFile(activeFile.id)}
                removeFile={getRemoveScopedFile(activeFile.id)}
                archivedFiles={archivedFiles}
                setArchivedFile={setArchivedFile}
              />
            ) : null}
          </DragOverlay>
        </div>
      </SortableContext>
    </DndContext>
  )
}
