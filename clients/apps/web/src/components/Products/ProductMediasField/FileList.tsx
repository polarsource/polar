import { FileObject } from '@/components/FileUpload'
import { useDraggable } from '@/hooks/draggable'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { schemas } from '@spaire/client'
import { DraggableFileListItem, FileListItem } from './FileListItem'

type ProductMediaFileObject = FileObject<schemas['ProductMediaFileRead']>

export const FileList = ({
  files,
  setFiles,
  removeFile,
}: {
  files: ProductMediaFileObject[]
  setFiles: (
    callback: (prev: ProductMediaFileObject[]) => ProductMediaFileObject[],
  ) => void
  removeFile: (fileId: string) => void
}) => {
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
      // convert our setFiles to one without callback
      setFiles(() => updated)
    },
    (_: ProductMediaFileObject[]) => {},
  )

  if (files.length === 0) {
    return <></>
  }

  let activeFile = undefined
  if (activeId) {
    activeFile = files.find(
      (file) => file.id === activeId,
    ) as ProductMediaFileObject
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
        {files.map((file) => (
          <DraggableFileListItem
            key={file.id}
            file={file}
            removeFile={getRemoveScopedFile(file.id)}
          />
        ))}
        <DragOverlay adjustScale={true}>
          {activeFile ? (
            <>
              <FileListItem
                file={activeFile}
                removeFile={getRemoveScopedFile(activeFile.id)}
              />
            </>
          ) : null}
        </DragOverlay>
      </SortableContext>
    </DndContext>
  )
}
