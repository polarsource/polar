import { useUpdateOrganization } from '@/hooks/queries'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { HiveOutlined } from '@mui/icons-material'
import { Organization, Repository } from '@polar-sh/sdk'
import { Modal } from '../../Modal'
import { useModal } from '../../Modal/useModal'
import { useDraggableEditorCallbacks } from '../Draggable/useDraggableEditorCallbacks'
import { DraggableProjectCard, ProjectCard } from './ProjectCard'
import { ProjectsModal } from './ProjectsModal'

export interface ProjectsEditorProps {
  organization: Organization
  featuredRepositories: Repository[]
  repositories: Repository[]
  disabled?: boolean
}

export const ProjectsEditor = ({
  organization,
  featuredRepositories,
  repositories,
  disabled,
}: ProjectsEditorProps) => {
  const { show, isShown, hide } = useModal()

  const updateOrganizationMutation = useUpdateOrganization()

  const {
    items: featuredProjects,
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    updateItems,
  } = useDraggableEditorCallbacks(featuredRepositories, (newRepos) =>
    updateOrganizationMutation.mutateAsync({
      id: organization.id,
      body: {
        profile_settings: {
          enabled: null,
          featured_projects: newRepos.map((repo) => repo.id),
        },
      },
    }),
  )

  const EditorEmptyState = () => {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="dark:border-polar-700 dark:bg-polar-900 rounded-4xl flex flex-col items-center gap-y-4 border-gray-200 bg-gray-50 py-16 shadow-sm">
          <HiveOutlined
            fontSize="large"
            className="text-blue-500 dark:text-blue-400"
          />
          <h3 className="text-center text-lg">Featured Projects</h3>
          <p
            className="cursor-pointer text-center text-blue-500 dark:text-blue-400"
            onClick={show}
          >
            Add featured projects to your profile
          </p>
        </div>
        <Modal
          className="w-full md:max-w-lg lg:max-w-lg"
          isShown={isShown}
          hide={hide}
          modalContent={
            <ProjectsModal
              featuredRepositories={featuredProjects}
              setFeaturedProjects={updateItems}
              repositories={repositories}
              hideModal={hide}
            />
          }
        />
      </div>
    )
  }

  if (featuredProjects.length === 0 && !disabled) {
    return <EditorEmptyState />
  }

  return featuredProjects.length > 0 ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={featuredProjects} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-2 md:flex-row md:justify-between">
            <h3 className="text-lg">Featured Projects</h3>
            {!disabled && (
              <div
                className="flex cursor-pointer flex-row items-center gap-x-2 text-sm text-blue-500 dark:text-blue-400"
                onClick={show}
              >
                <span>Configure</span>
              </div>
            )}
          </div>
          <div className="-mx-4 flex flex-row justify-start gap-6 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:flex-col md:gap-6 md:p-0 xl:grid-cols-2">
            {featuredProjects.map((project) => (
              <DraggableProjectCard
                className="w-[80%] shrink-0 md:w-full"
                key={project.id}
                organization={organization}
                repository={project}
                disabled={disabled}
              />
            ))}
          </div>

          <DragOverlay adjustScale={true}>
            {activeId ? (
              <ProjectCard
                organization={organization}
                repository={
                  featuredProjects.find(
                    (project) => project.id === activeId,
                  ) as Repository
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
            <ProjectsModal
              featuredRepositories={featuredProjects}
              setFeaturedProjects={updateItems}
              repositories={repositories}
              hideModal={hide}
            />
          }
        />
      </SortableContext>
    </DndContext>
  ) : null
}
