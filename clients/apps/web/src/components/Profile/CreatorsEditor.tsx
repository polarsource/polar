import { DragIndicatorOutlined } from '@mui/icons-material'
import { Organization, OrganizationProfileSettings } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useGetOrganization, useUpdateOrganization } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { CreatorsModal } from './CreatorsModal'
import { DraggableProps, useDraggable } from './useDraggable'

const CreatorCard = <T,>({
  id,
  organizationId,
  index,
  setItems,
  disabled,
}: DraggableProps<T> & { organizationId: string }) => {
  const { dragRef, previewRef, handlerId, isDragging } = useDraggable({
    id,
    index,
    setItems,
    disabled,
  })

  const organization = useGetOrganization(organizationId).data

  if (!organization) {
    return (
      <Card
        ref={previewRef}
        className={twMerge(
          'dark:hover:bg-polar-800 dark:text-polar-500 dark:hover:text-polar-300 transition-color flex h-full flex-col rounded-3xl text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600',
        )}
      ></Card>
    )
  }

  return (
    <Link href={organizationPageLink(organization)} data-handler-id={handlerId}>
      <Card
        ref={previewRef}
        className={twMerge(
          'dark:hover:bg-polar-800 dark:text-polar-500 dark:hover:text-polar-300 transition-color flex h-full flex-col rounded-3xl text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600',
          isDragging && 'opacity-30',
        )}
      >
        <CardHeader className="flex flex-row justify-between p-6">
          <div className="flex flex-col gap-y-4">
            <Avatar
              className="h-16 w-16"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <div className="flex flex-row items-baseline gap-x-3">
              <h3 className="dark:text-polar-50 text-lg text-gray-950">
                {organization.pretty_name || organization.name}
              </h3>
              {organization.pretty_name && (
                <h3 className="text-blue-500 dark:text-blue-400">
                  @{organization.name}
                </h3>
              )}
            </div>
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
          {organization.bio && (
            <p className="[text-wrap:pretty]">{organization.bio}</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-row items-center justify-between gap-x-4 p-6">
          <div className="flex-items flex items-center gap-x-2">
            <Button size="sm">Subscribe</Button>
            <Button size="sm" variant="ghost">
              GitHub Profile
            </Button>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}

export interface CreatorsEditorProps {
  organization: Organization
  profile: OrganizationProfileSettings
  disabled?: boolean
}

export const CreatorsEditor = ({
  organization,
  profile,
  disabled,
}: CreatorsEditorProps) => {
  const { show, isShown, hide } = useModal()
  const updateOrganizationMutation = useUpdateOrganization()

  const updateFeaturedCreators = async (creators: string[]) => {
    await updateOrganizationMutation.mutateAsync({
      id: organization.id,
      settings: {
        profile_settings: {
          ...profile,
          featured_organizations: creators,
        },
      },
    })
  }

  return (
    <>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col gap-y-2 md:flex-row md:justify-between">
          <h3 className="text-lg">Featured Creators</h3>
          {!disabled && (
            <Button variant="ghost" onClick={show}>
              Configure Creators
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {profile.featured_organizations.map((creator, i) => (
            <CreatorCard
              key={creator}
              index={i}
              id={creator}
              organizationId={creator}
              disabled={disabled}
              setItems={(prev) => updateCreators}
            />
          ))}
        </div>
      </div>
      <Modal
        className="w-full md:max-w-lg lg:max-w-lg"
        isShown={isShown}
        hide={hide}
        modalContent={
          <CreatorsModal
            creators={profile.featured_organizations}
            organization={organization}
            setCreators={updateFeaturedCreators}
            hideModal={hide}
          />
        }
      />
    </>
  )
}
