import { FileObject } from '@/components/FileUpload'
import { useDraggable } from '@/hooks/draggable'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useEffect, useMemo, useState } from 'react'
import { DraggableFileListItem, FileListItem } from './FileListItem'

const ITEMS_PER_PAGE = 20

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
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const getUpdateScopedFile = (fileId: string) => {
    return (callback: (prev: FileObject) => FileObject) => {
      updateFile(fileId, callback)
    }
  }

  const getRemoveScopedFile = (fileId: string) => {
    return () => removeFile(fileId)
  }

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) {
      return files
    }
    const query = searchQuery.toLowerCase()
    return files.filter((file) => file.name.toLowerCase().includes(query))
  }, [files, searchQuery])

  // Paginate filtered files
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredFiles.slice(startIndex, endIndex)
  }, [filteredFiles, currentPage])

  const totalPages = Math.ceil(filteredFiles.length / ITEMS_PER_PAGE)

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(
    paginatedFiles,
    (updated) => {
      // Update the files with the new order from drag-and-drop
      // Create a map of updated files for efficient lookup
      const updatedMap = new Map(updated.map((file, index) => [file.id, { file, newIndex: index }]))
      
      setFiles((prev) => {
        const newFiles = [...prev]
        // Update only the files that were reordered
        updatedMap.forEach(({ file }, fileId) => {
          const originalIndex = prev.findIndex((f) => f.id === fileId)
          if (originalIndex !== -1) {
            newFiles[originalIndex] = file
          }
        })
        return newFiles
      })
    },
    (_: FileObject[]) => {},
  )

  if (files.length === 0) {
    return <></>
  }

  let activeFile = undefined
  if (activeId) {
    activeFile = paginatedFiles.find((file) => file.id === activeId) as FileObject
  }

  return (
    <div className="flex flex-col gap-y-4">
      {/* Search bar */}
      {files.length > 5 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchOutlined
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fontSize="small"
            />
            <Input
              type="text"
              placeholder="Search files by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10"
            />
          </div>
          {searchQuery && (
            <Button
              variant="secondary"
              onClick={() => setSearchQuery('')}
              size="sm"
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* File count */}
      {filteredFiles.length > 0 && (
        <div className="text-sm text-gray-500">
          Showing {paginatedFiles.length} of {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
          {searchQuery && ` (filtered from ${files.length} total)`}
        </div>
      )}

      {/* No results message */}
      {filteredFiles.length === 0 && searchQuery && (
        <div className="text-center py-8 text-gray-500">
          No files found matching "{searchQuery}"
        </div>
      )}

      {/* File list */}
      {paginatedFiles.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={paginatedFiles} strategy={rectSortingStrategy}>
            <div className="flex flex-col gap-y-6">
              <div className="-mx-4 flex-row justify-start gap-4 px-4 pb-4 md:mx-0 md:p-0">
                {paginatedFiles.map((file) => (
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
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            size="sm"
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            size="sm"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
