import { useAuth } from '@/hooks'
import { Organization } from '@polar-sh/sdk'
import {
  Avatar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms'
import { useListAllOrganizations } from 'polarkit/hooks'
import { useState } from 'react'

const OnBehalfOf = ({
  onChange,
}: {
  onChange: (o: Organization | undefined) => void
}) => {
  const { currentUser } = useAuth()

  const [attributePledgeTo, setAttributePledgeTo] = useState<
    Organization | undefined
  >(undefined)

  const organizations = useListAllOrganizations()

  const canAttributeAsOrganizations = (organizations.data?.items || []).filter(
    (o) => o.name !== currentUser?.username,
  )

  const show = canAttributeAsOrganizations.length > 0

  const onAttributePledgeChange = (id: string) => {
    const o = canAttributeAsOrganizations.find((o) => o.id === id)
    setAttributePledgeTo(o)
    onChange(o)
  }

  return (
    <>
      {show && (
        <div>
          <label
            htmlFor="attribute_pledge"
            className="dark:text-polar-400 mb-2 text-sm font-medium text-gray-500"
          >
            Fund on behalf of
          </label>

          <Select
            onValueChange={onAttributePledgeChange}
            value={attributePledgeTo?.id ?? ''}
            name="attribute_pledge"
          >
            <SelectTrigger className="w-full">
              {attributePledgeTo ? (
                <SelectValue placeholder={`${attributePledgeTo.name}`} />
              ) : (
                <SelectValue
                  placeholder={`Yourself (${
                    currentUser?.username || currentUser?.email
                  })`}
                />
              )}
            </SelectTrigger>

            <SelectContent>
              {canAttributeAsOrganizations.map((o) => (
                <SelectItem value={o.id} key={o.id}>
                  <div className="flex items-center space-x-2">
                    <Avatar avatar_url={o.avatar_url} name={o.name} />
                    <span>{o.pretty_name || o.name}</span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="">
                <div className="flex items-center space-x-2">
                  <Avatar
                    avatar_url={currentUser?.avatar_url}
                    name={currentUser?.username ?? ''}
                  />
                  <span>{currentUser?.username || currentUser?.email}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {attributePledgeTo && (
            <div className="dark:text-polar-500 mt-2 text-xs text-gray-400">
              By pledging on behalf of{' '}
              {attributePledgeTo.pretty_name || attributePledgeTo.name}, you
              confirm are authorized to do so on their behalf.
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default OnBehalfOf
