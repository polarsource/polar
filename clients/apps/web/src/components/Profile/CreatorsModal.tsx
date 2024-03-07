import { Organization, Platforms } from '@polar-sh/sdk'
import { api } from 'polarkit'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Separator } from 'polarkit/components/ui/separator'
import { useGetOrganization } from 'polarkit/hooks'
import { useState } from 'react'

export interface CreatorsModalProps {
  creators: string[]
  organization: Organization
  hideModal: () => void
  setCreators: (producer: (creators: string[]) => string[]) => void
}

export const CreatorsModal = ({
  creators,
  organization,
  hideModal,
  setCreators,
}: CreatorsModalProps) => {
  const [username, setUsername] = useState('')

  const addCreator = (organizationName: string) => {
    api.organizations
      .lookup({
        organizationName,
        platform: Platforms.GITHUB,
      })
      .then((org) => {
        setCreators((creators) => [...creators, org.id])
      })
  }

  const removeRepository = (creator: string) => {
    setCreators((creators) => creators.filter((c) => c !== creator))
  }

  return (
    <div className="flex flex-col gap-y-8 p-8">
      <div className="flex flex-col gap-y-2">
        <h3>Featured Creators</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select creators that you want to feature on your profile
        </p>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="GitHub Username or Organization name"
        />
        <Button onClick={(e) => addCreator(username)}>Add</Button>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[300px] w-full flex-col overflow-y-auto">
          {creators.map((creator) => (
            <CreatorRow key={creator} organizationId={creator} />
          ))}
        </div>
        <Separator className="dark:bg-polar-600" />
        <div className="flex flex-row items-center justify-end gap-x-2">
          <Button onClick={hideModal}>Save</Button>
        </div>
      </div>
    </div>
  )
}

const CreatorRow = ({ organizationId }: { organizationId: string }) => {
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
    </div>
  )
}
