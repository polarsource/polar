import { Modal } from '@/components/Modal'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { LanguageOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { OgObject } from 'open-graph-scraper-lite/dist/lib/types'
import { twMerge } from 'tailwind-merge'
import { useModal } from '../../Modal/useModal'
import { useDraggableEditorCallbacks } from '../Draggable/useDraggableEditorCallbacks'
import { DraggableLinkCard, LinkCard } from './LinkCard'
import { LinksModal } from './LinksModal'

export interface Link {
  id: string
  opengraph: OgObject
  url: string
}

export interface LinksEditorProps {
  organization: Organization
  links: { opengraph: OgObject; url: string }[]
  onChange: (organizations: Link[]) => void
  disabled?: boolean
  variant?: 'grid' | 'column'
}

export const LinksEditor = ({
  organization,
  links,
  onChange,
  disabled,
  variant = 'grid',
}: LinksEditorProps) => {
  const { show, isShown, hide } = useModal()

  const {
    items: selectedLinks,
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    updateItems,
  } = useDraggableEditorCallbacks(
    links.map((link, index) => ({ id: link.url + index, ...link })) as Link[],
    onChange,
  )

  const EditorEmptyState = () => {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="dark:border-polar-800 dark:bg-polar-900 flex flex-col items-center gap-y-4 rounded-3xl border-gray-100 bg-white p-8 py-16 shadow-sm">
          <LanguageOutlined
            fontSize="large"
            className="text-blue-500 dark:text-blue-400"
          />
          <h3 className="text-center text-lg">Links</h3>
          <p
            className={twMerge(
              'cursor-pointer text-center text-blue-500 dark:text-blue-400',
              variant === 'column' && 'text-sm',
            )}
            onClick={show}
          >
            Add links relevant links to the profile
          </p>
        </div>
        <Modal
          className="w-full md:max-w-lg lg:max-w-lg"
          isShown={isShown}
          hide={hide}
          modalContent={
            <LinksModal
              links={selectedLinks}
              organization={organization}
              setLinks={updateItems}
              hideModal={hide}
            />
          }
        />
      </div>
    )
  }

  if (selectedLinks.length === 0 && !disabled) {
    return <EditorEmptyState />
  }

  return selectedLinks.length > 0 ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={selectedLinks} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col items-start gap-y-2 md:flex-row md:justify-between">
            <h3 className="text-lg">Links</h3>
            {!disabled && (
              <div
                className="flex cursor-pointer flex-row items-center gap-x-2 text-sm text-blue-500 dark:text-blue-400"
                onClick={show}
              >
                <span>Configure</span>
              </div>
            )}
          </div>
          <div
            className={twMerge(
              variant === 'grid'
                ? 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'
                : 'flex flex-col gap-y-4',
            )}
          >
            {selectedLinks.map((link) => (
              <DraggableLinkCard
                key={link.id}
                link={link}
                disabled={disabled}
              />
            ))}
          </div>
          <DragOverlay adjustScale={true}>
            {activeId ? (
              <LinkCard
                link={
                  selectedLinks.find((link) => link.id === activeId) as Link
                }
              />
            ) : null}
          </DragOverlay>
        </div>
        <Modal
          className="w-full md:max-w-lg lg:max-w-lg"
          isShown={isShown}
          hide={hide}
          modalContent={
            <LinksModal
              links={selectedLinks}
              organization={organization}
              setLinks={updateItems}
              hideModal={hide}
            />
          }
        />
      </SortableContext>
    </DndContext>
  ) : null
}
