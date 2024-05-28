import { FileObject } from '@/components/FileUpload'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { twMerge } from 'tailwind-merge'
import { DraggableFileListItem, FileListItem } from './FileListItem'
import { useDraggable } from './useDraggable'

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
    updateItems,
  } = useDraggable(
    files,
    (updated) => {
      // convert our setFiles to one without callback
      setFiles((prev) => updated)
    },
    (files: FileObject[]) => {
      console.log('updated file orders', files)
    },
  )

  if (files.length === 0) {
    return <></>
  }

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
          <div
            className={twMerge(
              '-mx-4 flex-row justify-start gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:p-0',
            )}
          >
            {files.map((file) => (
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
          <DragOverlay adjustScale={true}>
            {activeFile ? (
              <>
                <FileListItem
                  file={activeFile}
                  updateFile={getUpdateScopedFile(activeFile.id)}
                  removeFile={getRemoveScopedFile(activeFile.id)}
                  archivedFiles={archivedFiles}
                  setArchivedFile={setArchivedFile}
                />
              </>
            ) : null}
          </DragOverlay>
        </div>
      </SortableContext>
    </DndContext>
  )
}
