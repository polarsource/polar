import { CloseOutlined } from '@mui/icons-material'
import { Organization, Platforms } from '@polar-sh/sdk'
import { api } from 'polarkit'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Banner } from 'polarkit/components/ui/molecules'
import { Separator } from 'polarkit/components/ui/separator'
import { useGetOrganization } from 'polarkit/hooks'
import { useState } from 'react'

export interface CreatorsModalProps {
  creators: Organization[]
  organization: Organization
  hideModal: () => void
  setCreators: (producer: (creators: Organization[]) => Organization[]) => void
}

export const CreatorsModal = ({
  creators,
  organization,
  hideModal,
  setCreators,
}: CreatorsModalProps) => {
  const [username, setUsername] = useState('')
  const [showOrgNotFound, toggleOrgNotFound] = useState(false)

  const addCreator = (organizationName: string) => {
    toggleOrgNotFound(false)

    if (creators.find((c) => c.name === organizationName)) {
      return
    }

    api.organizations
      .lookup({
        organizationName,
        platform: Platforms.GITHUB,
      })
      .then((org) => {
        setCreators((creators) => [...creators, org])
      })
      .catch((e) => {
        toggleOrgNotFound(true)
      })
  }

  const removeCreator = (creator: Organization) => {
    setCreators((creators) => creators.filter((c) => c.id !== creator.id))
  }

  return (
    <div className="flex flex-col gap-y-8 p-8">
      <div className="flex flex-col gap-y-2">
        <h3>Featured Developers</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select developers that you want to feature on the profile. The
          developer must be on Polar.
        </p>
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center gap-x-4">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="GitHub Username or Organization name"
          />
          <Button onClick={(e) => addCreator(username)}>Add</Button>
        </div>
        {showOrgNotFound && (
          <Banner color="red">User or Organization not found</Banner>
        )}
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[300px] w-full flex-col overflow-y-auto">
          {creators.map((creator) => (
            <CreatorRow
              key={creator.id}
              organizationId={creator.id}
              onRemove={removeCreator}
            />
          ))}
        </div>
        <Separator className="dark:bg-polar-600" />
        <div className="flex flex-row items-center justify-end gap-x-2">
          <Button size="sm" variant="secondary" onClick={hideModal}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

const CreatorRow = ({
  organizationId,
  onRemove,
}: {
  organizationId: string
  onRemove: (creator: Organization) => void
}) => {
  const creator = useGetOrganization(organizationId).data

  if (!creator) {
    return null
  }

  return (
    <div className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-2 rounded-lg px-4 py-3 text-sm text-gray-950 hover:bg-gray-100">
      <div className="flex flex-row items-center gap-x-2">
        <Avatar
          className="h-8 w-8"
          avatar_url={creator.avatar_url}
          name={creator.name}
        />
        <span>{creator.name}</span>
      </div>
      <Button
        className="h-6 w-6"
        onClick={(e) => onRemove(creator)}
        variant="secondary"
        size="icon"
      >
        <CloseOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}
