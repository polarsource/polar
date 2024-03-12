import revalidate from '@/app/actions'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import {
  ArrowForwardOutlined,
  HiveOutlined,
  TuneOutlined,
} from '@mui/icons-material'
import { Organization, Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import { useUpdateOrganization } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { Modal } from '../../Modal'
import { useModal } from '../../Modal/useModal'
import { useDraggableEditorCallbacks } from '../Draggable/useDraggableEditorCallbacks'
import { DraggableProjectCard, ProjectCard } from './ProjectCard'
import { ProjectsModal } from './ProjectsModal'

export interface ProjectsEditorProps {
  organization: Organization
  featuredRepositories: string[]
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
  } = useDraggableEditorCallbacks(
    featuredRepositories
      .map((id) => repositories.find((r) => r.id === id))
      .filter((value): value is Repository => Boolean(value)),
    (newRepos) =>
      updateOrganizationMutation
        .mutateAsync({
          id: organization.id,
          settings: {
            profile_settings: {
              featured_projects: newRepos.map((repo) => repo.id),
            },
          },
        })
        .then(() => revalidate(`organization:${organization.name}`)),
  )

  const EditorEmptyState = () => {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="dark:border-polar-800 dark:bg-polar-900 flex flex-col items-center gap-y-4 rounded-3xl border-gray-100 bg-white py-16 shadow-sm">
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
              organization={organization}
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
            {disabled ? (
              <Link
                className="text-sm text-blue-500 dark:text-blue-400"
                href={organizationPageLink(organization, 'repositories')}
              >
                <span>View all projects</span>
                <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
              </Link>
            ) : (
              <div
                className="flex cursor-pointer flex-row items-center gap-x-2 text-sm text-blue-500 dark:text-blue-400"
                onClick={show}
              >
                <TuneOutlined fontSize="small" />
                <span>Configure</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {featuredProjects.map((project, i) => (
              <DraggableProjectCard
                key={project.id}
                repository={project}
                disabled={disabled}
              />
            ))}
          </div>

          <DragOverlay adjustScale={true}>
            {activeId ? (
              <ProjectCard
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
              organization={organization}
              hideModal={hide}
            />
          }
        />
      </SortableContext>
    </DndContext>
  ) : null
}
