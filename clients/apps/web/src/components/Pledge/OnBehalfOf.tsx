import { useAuth } from '@/hooks'
import { Organization } from '@polar-sh/sdk'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/select'
import { useListOrganizations } from 'polarkit/hooks'
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

  const organizations = useListOrganizations()

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
            Attribute pledge to
          </label>

          <Select
            onValueChange={onAttributePledgeChange}
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
                  {o.name}
                </SelectItem>
              ))}
              <SelectItem value="">
                Yourself ({currentUser?.username || currentUser?.email})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}

export default OnBehalfOf
