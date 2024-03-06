import { DragIndicatorOutlined } from '@mui/icons-material'
import { useCallback, useRef, useState } from 'react'
import { DropTargetMonitor, XYCoord, useDrag, useDrop } from 'react-dnd'

export interface DraggableProps {
  id: any
  text: string
  index: number
  moveCard: (dragIndex: number, hoverIndex: number) => void
}

interface DragItem {
  index: number
  id: string
  type: string
}

const Draggable = ({ id, text, index, moveCard }: DraggableProps) => {
  const ref = useRef<HTMLDivElement>(null)

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
      if (!ref.current) {
        return
      }

      const dragIndex = item.index
      const hoverIndex = index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect()

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
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

  const [{ isDragging }, drag] = useDrag({
    type: 'card',
    item: () => {
      return { id, index }
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const opacity = isDragging ? 0 : 1

  drag(drop(ref))

  return (
    <div
      ref={ref}
      className="dark:hover:bg-polar-700 hover:bg-gray-75 group flex w-full cursor-grab flex-row items-center justify-between gap-x-6 rounded-xl px-4 py-2 text-sm transition-colors"
      style={{ opacity }}
      data-handler-id={handlerId}
    >
      <span>{text}</span>
      <DragIndicatorOutlined
        className="dark:text-polar-600 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
        fontSize="small"
      />
    </div>
  )
}

export interface Section {
  id: number
  text: string
}

export interface ProfileSectionEditorProps {
  sections: Section[]
}

export const ProfileSectionEditor = ({
  sections: initialSections,
}: ProfileSectionEditorProps) => {
  const [sections, setSections] = useState<Section[]>(initialSections)

  const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
    setSections((prev) => {
      let sections = [...prev] // create a copy of previous
      const dragged = sections[dragIndex]
      sections.splice(dragIndex, 1) // remove the dragged from its original position
      sections.splice(hoverIndex, 0, dragged) // insert the dragged at the new position
      return sections
    })
  }, [])

  return (
    <div className="flex w-fit flex-col gap-y-6">
      <h3 className="px-4 text-xl">Profile</h3>
      <div>
        {sections.map((card, i) => (
          <Draggable
            key={card.text}
            index={i}
            id={card.id}
            text={card.text}
            moveCard={moveCard}
          />
        ))}
      </div>
    </div>
  )
}
