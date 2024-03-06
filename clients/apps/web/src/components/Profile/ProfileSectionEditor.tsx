import { useCallback, useRef, useState } from 'react'
import { DndProvider, DragSourceMonitor, XYCoord, useDrag } from 'react-dnd'
import { TouchBackend, TouchBackendOptions } from 'react-dnd-touch-backend'

const style = {
  border: '1px dashed gray',
  padding: '0.5rem 1rem',
  marginBottom: '.5rem',
  backgroundColor: 'white',
  cursor: 'move',
}

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

  const [{ handlerId }, drop] = useDrag(
    () => ({
      type: 'card',
      item: { text },
      accept: 'card',
      collect(monitor) {
        return {
          handlerId: monitor.getHandlerId(),
        }
      },
      hover(item: DragItem, monitor: DragSourceMonitor) {
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
    }),
    [],
  )

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
    <div ref={ref} style={{ ...style, opacity }} data-handler-id={handlerId}>
      {text}
    </div>
  )
}

export interface Section {
  id: number
  text: string
}

export interface ContainerState {
  sections: Section[]
}

export const ProfileSectionEditor = () => {
  const [sections, setSections] = useState<Section[]>([
    {
      id: 1,
      text: 'Posts',
    },
    {
      id: 2,
      text: 'Subscription Tiers',
    },
    {
      id: 3,
      text: 'Repositories',
    },
    {
      id: 4,
      text: 'Issues',
    },
  ])

  const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
    setSections((prev) =>
      prev.splice(dragIndex, 1, prev[hoverIndex], prev[dragIndex] as Section),
    )
  }, [])

  return (
    <DndProvider backend={TouchBackend} options={{} as TouchBackendOptions}>
      <div style={style}>
        {sections.map((card, i) => (
          <Draggable
            key={card.id}
            index={i}
            id={card.id}
            text={card.text}
            moveCard={moveCard}
          />
        ))}
      </div>
    </DndProvider>
  )
}
