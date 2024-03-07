import { Organization, Platforms } from '@polar-sh/sdk'
import { api } from 'polarkit'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Separator } from 'polarkit/components/ui/separator'
import { useCallback, useState } from 'react'

export interface CreatorsModalProps {
  creators: Organization[]
  selectedCreators: Organization[]
  organization: Organization
  hideModal: () => void
  setCreators: (creators: Organization[]) => void
}

export const CreatorsModal = ({
  creators,
  organization,
  selectedCreators,
  hideModal,
  setCreators,
}: CreatorsModalProps) => {
  const [username, setUsername] = useState('')

  const uniqueCreators = new Map([
    ...selectedCreators.map((repo) => [repo.id, repo] as const),
    ...creators.map((repo) => [repo.id, repo] as const),
  ])

  const addCreator = useCallback(
    async (organizationName: string) => {
      const creator = await api.organizations.lookup({
        organizationName,
        platform: Platforms.GITHUB,
      })

      if (creator) {
        setCreators([creator, ...selectedCreators])
      }
    },
    [selectedCreators, setCreators],
  )

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
          {[...uniqueCreators.values()].map((creator) => (
            <div
              key={creator.id}
              className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-2 rounded-lg px-4 py-3 text-sm text-gray-950 hover:bg-gray-100"
            >
              <div className="flex flex-row items-center gap-x-2">
                <Avatar
                  className="h-8 w-8"
                  avatar_url={creator.avatar_url}
                  name={creator.name}
                />
                <span>{creator.name}</span>
              </div>
              <div className="flex flex-row items-center gap-x-4">
                <Checkbox
                  checked={selectedCreators.some(
                    (org) => org.id === creator.id,
                  )}
                  onCheckedChange={(v) => {
                    if (Boolean(v)) {
                      setCreators([...selectedCreators, creator])
                    } else {
                      setCreators(
                        selectedCreators.filter((org) => org.id !== creator.id),
                      )
                    }
                  }}
                />
              </div>
            </div>
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
