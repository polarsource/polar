import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ArrowForwardOutlined,
  HiveOutlined,
  TuneOutlined,
} from '@mui/icons-material'
import {
  Organization,
  OrganizationProfileSettings,
  Repository,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useUpdateOrganization } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useState } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { DraggableProjectCard, ProjectCard } from './ProjectCard'
import { ProjectsModal } from './ProjectsModal'

export interface ProjectsEditorProps {
  organization: Organization
  profile: OrganizationProfileSettings
  repositories: Repository[]
  disabled?: boolean
}

export const ProjectsEditor = ({
  organization,
  profile,
  repositories,
  disabled,
}: ProjectsEditorProps) => {
  const [featuredProjects, setFeaturedProjects] = useState(
    profile.featured_projects
      .map((id) => repositories.find((r) => r.id === id))
      .filter((value): value is Repository => Boolean(value)),
  )

  const [activeId, setActiveId] = useState<string | number | null>(null)
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor))

  const { show, isShown, hide } = useModal()

  const updateOrganizationMutation = useUpdateOrganization()

  const updateFeaturedProjects = (
    producer: (prev: Repository[]) => Repository[],
  ) => {
    const newRepos = producer(featuredProjects)

    setFeaturedProjects(newRepos)

    updateOrganizationMutation.mutateAsync({
      id: organization.id,
      settings: {
        profile_settings: {
          featured_projects: newRepos.map((repo) => repo.id),
        },
      },
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    console.log(active, over)
    if (active.id !== over?.id) {
      updateFeaturedProjects((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }

    setActiveId(null)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

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
              setFeaturedProjects={updateFeaturedProjects}
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
              setFeaturedProjects={updateFeaturedProjects}
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
