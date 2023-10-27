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
import { useCallback, useEffect, useState } from 'react'

const TeamSelect = ({
  onChange,
  allowSelfSelect,
  title,
  defaultToFirstOrganization,
}: {
  onChange: (o: Organization | undefined) => void
  allowSelfSelect: boolean
  title?: string
  defaultToFirstOrganization?: boolean
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

  const onAttributePledgeChange = useCallback(
    (id: string) => {
      const o = canAttributeAsOrganizations.find((o) => o.id === id)
      setAttributePledgeTo(o)
      onChange(o)
    },
    [canAttributeAsOrganizations, onChange],
  )

  const [userSelectedTeam, setUserSelectedTeam] = useState(false)

  useEffect(() => {
    if (
      defaultToFirstOrganization &&
      !userSelectedTeam &&
      canAttributeAsOrganizations.length > 0 &&
      canAttributeAsOrganizations[0].id !== attributePledgeTo?.id
    ) {
      onAttributePledgeChange(canAttributeAsOrganizations[0].id)
    }
  }, [
    defaultToFirstOrganization,
    canAttributeAsOrganizations,
    attributePledgeTo,
    userSelectedTeam,
    onAttributePledgeChange,
  ])

  return (
    <>
      {show && (
        <div>
          <label
            htmlFor="attribute_pledge"
            className="dark:text-polar-400 text-sm font-medium text-gray-500"
          >
            {title || 'Fund on behalf of'}
          </label>

          <Select
            onValueChange={(v) => {
              setUserSelectedTeam(true)
              onAttributePledgeChange(v)
            }}
            value={attributePledgeTo?.id ?? ''}
            name="attribute_pledge"
          >
            <SelectTrigger className="mt-2 w-full">
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
              {allowSelfSelect ? (
                <SelectItem value="">
                  <div className="flex items-center space-x-2">
                    <Avatar
                      avatar_url={currentUser?.avatar_url}
                      name={currentUser?.username ?? ''}
                    />
                    <span>{currentUser?.username || currentUser?.email}</span>
                  </div>
                </SelectItem>
              ) : null}
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

export default TeamSelect
