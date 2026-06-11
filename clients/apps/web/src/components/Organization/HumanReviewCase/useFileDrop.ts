import { DragEvent, useRef, useState } from 'react'

interface FileDrop {
  isDragging: boolean
  dropHandlers: {
    onDragEnter: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
  }
}

export const useFileDrop = (onFiles: (files: File[]) => void): FileDrop => {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const draggingFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

  const onDragEnter = (e: DragEvent) => {
    if (!draggingFiles(e)) return
    e.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }

  const onDragOver = (e: DragEvent) => {
    if (draggingFiles(e)) e.preventDefault()
  }

  const onDragLeave = (e: DragEvent) => {
    if (!draggingFiles(e)) return
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    if (!draggingFiles(e)) return
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    onFiles(Array.from(e.dataTransfer.files))
  }

  return {
    isDragging,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
