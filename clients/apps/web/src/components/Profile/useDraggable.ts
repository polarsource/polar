import { useCallback, useRef } from 'react'
import { DropTargetMonitor, XYCoord, useDrag, useDrop } from 'react-dnd'

interface DragItem {
  index: number
  id: string
  type: string
}

export interface DraggableProps<T> {
  id: string
  index: number
  setItems: (producer: (prev: T[]) => T[]) => void
  disabled?: boolean
}

export const useDraggable = <T>({
  id,
  index,
  setItems,
  disabled,
}: DraggableProps<T>) => {
  const dragRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const moveCard = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setItems((prev) => {
        const sections = [...prev]
        const dragged = sections[dragIndex]
        sections.splice(dragIndex, 1) // remove the dragged from its original position
        sections.splice(hoverIndex, 0, dragged) // insert the dragged at the new position
        return sections
      })
    },
    [setItems],
  )

  const [{ handlerId }, drop] = useDrop<
    DragItem,
    void,
    { handlerId: any | null }
  >({
    accept: 'card',
    collect(monitor: DropTargetMonitor<DragItem, void>) {
      return {
        handlerId: monitor.getHandlerId(),
      }
    },
    hover(item: DragItem, monitor) {
      if (!previewRef.current) {
        return
      }

      const dragIndex = item.index
      const hoverIndex = index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return
      }

      // Determine rectangle on screen
      const hoverBoundingRect = previewRef.current?.getBoundingClientRect()

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

      // Get horizontal middle
      const hoverMiddleX =
        (hoverBoundingRect.right - hoverBoundingRect.left) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top

      // Get pixels to the left
      const hoverClientX = (clientOffset as XYCoord).x - hoverBoundingRect.left

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        // Dragging right
        if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
          return
        }

        // Dragging left
        if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
          return
        }
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        // Dragging right
        if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
          return
        }

        // Dragging left
        if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
          return
        }
      }

      // Time to actually perform the action
      moveCard(dragIndex, hoverIndex)

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    },
  })

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'card',
    item: () => {
      return { id, index }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  if (!disabled) {
    drag(dragRef)
    drop(preview(previewRef))
  }

  return { dragRef, previewRef, handlerId, isDragging }
}
