import {
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useState } from 'react'

interface Draggable {
  id: string
}

export const useDraggable = <T extends Draggable[]>(
  items: T,
  setItems: (prev: T) => void,
  onChange: (data: T) => void,
) => {
  const [activeId, setActiveId] = useState<string | number | null>(null)

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor))

  function handleDragStart(event: DragStartEvent) {
    console.log('dragstart', event)
    setActiveId(event.active.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.id !== over?.id) {
      updateItems((prev): T => {
        const oldIndex = prev.findIndex((item) => item.id === active.id)
        const newIndex = prev.findIndex((item) => item.id === over?.id)

        return arrayMove(prev, oldIndex, newIndex) as T
      })
    }

    setActiveId(null)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  const updateItems = (producer: (prev: T) => T) => {
    const newCreators = producer(items)

    setItems(newCreators)

    onChange(newCreators)
  }

  return {
    items,
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    updateItems,
  }
}
