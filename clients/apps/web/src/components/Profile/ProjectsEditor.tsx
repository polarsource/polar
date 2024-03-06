import { StarIcon } from '@heroicons/react/20/solid'
import {
  ArrowForwardOutlined,
  DragIndicatorOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import { Organization, Repository, Visibility } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Pill,
} from 'polarkit/components/ui/atoms'
import { formatStarsNumber } from 'polarkit/utils'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useCallback, useRef, useState } from 'react'
import {
  DndProvider,
  DropTargetMonitor,
  XYCoord,
  useDrag,
  useDrop,
} from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { ProjectsModal } from './ProjectsModal'

interface DragItem {
  index: number
  id: string
  type: string
}

export interface DraggableProps {
  id: any
  repository: Repository
  index: number
  moveCard: (dragIndex: number, hoverIndex: number) => void
  disabled?: boolean
}

const Draggable = ({
  id,
  repository,
  index,
  moveCard,
  disabled,
}: DraggableProps) => {
  const dragRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

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

  return (
    <Link
      href={organizationPageLink(repository.organization, repository.name)}
      key={repository.id}
      data-handler-id={handlerId}
    >
      <Card
        ref={previewRef}
        className={twMerge(
          'dark:hover:bg-polar-800 dark:text-polar-500 dark:hover:text-polar-300 transition-color flex h-full flex-col rounded-3xl text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600',
          isDragging && 'opacity-30',
        )}
      >
        <CardHeader className="flex flex-row justify-between p-6">
          <div className="flex flex-row items-baseline gap-x-3">
            <span className="text-[20px] text-blue-500">
              <HiveOutlined fontSize="inherit" />
            </span>
            <h3 className="dark:text-polar-50 text-lg text-gray-950">
              {repository.name}
            </h3>
          </div>
          {!disabled && (
            <span ref={dragRef} className="cursor-grab">
              <DragIndicatorOutlined
                className={twMerge('dark:text-polar-600 text-gray-400')}
                fontSize="small"
              />
            </span>
          )}
        </CardHeader>
        <CardContent className="flex h-full grow flex-col flex-wrap px-6 py-0">
          {repository.description && <p>{repository.description}</p>}
        </CardContent>
        <CardFooter className="flex flex-row items-center gap-x-4 p-6">
          {repository.license ? (
            <Pill className="px-3" color="blue">
              {repository.license}
            </Pill>
          ) : (
            <Pill className="grow-0 px-3" color="gray">
              Unlicensed
            </Pill>
          )}
          {repository.visibility === Visibility.PRIVATE ? (
            <Pill className="grow-0 px-3" color="gray">
              Private
            </Pill>
          ) : null}
          <span className="flex flex-row items-center gap-x-1 text-sm">
            <StarIcon className="h-4 w-4" />
            <span className="pt-.5">
              {formatStarsNumber(repository.stars ?? 0)}
            </span>
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}

export interface ProjectsEditorProps {
  organization: Organization
  repositories: Repository[]
  disabled?: boolean
}

export const ProjectsEditor = ({
  organization,
  repositories: initialRepositories,
  disabled,
}: ProjectsEditorProps) => {
  const [repositories, setRepositories] = useState<Repository[]>(
    initialRepositories.slice(0, 4),
  )

  const { show, isShown, hide } = useModal()

  // Touch-based browser check
  // https://stackoverflow.com/a/52855084
  const backend = window.matchMedia('(pointer: coarse)').matches
    ? TouchBackend
    : HTML5Backend

  const hasNative =
    document &&
    (document.elementsFromPoint || 'msElementsFromPoint' in document)

  function getDropTargetElementsAtPoint(
    x: number,
    y: number,
    dropTargets: HTMLElement[],
  ) {
    return dropTargets.filter((t) => {
      const rect = t.getBoundingClientRect()
      return (
        x >= rect.left && x <= rect.right && y <= rect.bottom && y >= rect.top
      )
    })
  }

  // use custom function only if elementsFromPoint is not supported
  const backendOptions = {
    getDropTargetElementsAtPoint: !hasNative && getDropTargetElementsAtPoint,
  }

  const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
    setRepositories((prev) => {
      let sections = [...prev] // create a copy of previous
      const dragged = sections[dragIndex]
      sections.splice(dragIndex, 1) // remove the dragged from its original position
      sections.splice(hoverIndex, 0, dragged) // insert the dragged at the new position
      return sections
    })
  }, [])

  return (
    <DndProvider backend={backend} options={backendOptions}>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col gap-y-2 md:flex-row md:justify-between">
          <h3 className="text-lg">Featured Projects</h3>
          {disabled ? (
            <Link
              className="text-sm text-blue-500 dark:text-blue-400"
              href={organizationPageLink(organization, 'repositories')}
            >
              <span>View all projects</span>
              <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
            </Link>
          ) : (
            <Button variant="ghost" onClick={show}>
              Configure Projects
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {repositories.map((repository, i) => (
            <Draggable
              key={repository.id}
              index={i}
              id={repository.id}
              repository={repository}
              moveCard={moveCard}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
      <Modal
        className="w-full md:max-w-lg lg:max-w-lg"
        isShown={isShown}
        hide={hide}
        modalContent={
          <ProjectsModal
            repositories={initialRepositories}
            organization={organization}
            setRepositories={setRepositories}
            hideModal={hide}
          />
        }
      />
    </DndProvider>
  )
}
