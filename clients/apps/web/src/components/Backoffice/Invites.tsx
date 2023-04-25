import { InviteRead } from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import {
  useBackofficeCreateInviteCode,
  useBackofficeListInvites,
} from 'polarkit/hooks'
import { useState } from 'react'

const Invites = () => {
  const invites = useBackofficeListInvites()
  const data = invites.data

  const createNewMutation = useBackofficeCreateInviteCode()

  const [createdCode, setCreatedCode] = useState('')

  const createNewCode = async () => {
    const res = await createNewMutation.mutateAsync()
    setCreatedCode(res.code)
  }

  return (
    <>
      <PrimaryButton fullWidth={false} onClick={createNewCode}>
        Create new code
      </PrimaryButton>
      {createdCode && (
        <div className="bg-green-200 p-2">
          The code is <code className="font-bold">{createdCode}</code>
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-300">
        <thead>
          <tr>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Code
            </th>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Email
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data && data.map((p) => <Item invite={p} key={p.code} />)}
        </tbody>
      </table>
    </>
  )
}

export default Invites

const Item = (props: { invite: InviteRead }) => {
  const { invite: i } = props
  return (
    <>
      <tr>
        <tr>
          <pre>{i.code}</pre>
        </tr>
        <tr>
          <pre>{i.sent_to_email}</pre>
        </tr>
      </tr>
    </>
  )
}
