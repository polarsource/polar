'use client'

import { InviteRead } from 'polarkit/api/client'
import { PolarTimeAgo, PrimaryButton } from 'polarkit/components/ui'
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
  const [note, setNote] = useState<string>('')

  const createNewCode = async () => {
    const res = await createNewMutation.mutateAsync(note)
    setCreatedCode(res.code)
  }

  return (
    <div className="mt-4 flex flex-col space-y-4">
      <label htmlFor="invite-note">Note</label>
      <input
        type="text"
        id="invite-note"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setNote(e.target.value)
        }}
      />
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
              Created by
            </th>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Claimed by
            </th>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Created
            </th>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Note
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data && data.map((p) => <Item invite={p} key={p.code} />)}
        </tbody>
      </table>
    </div>
  )
}

export default Invites

const Item = (props: { invite: InviteRead }) => {
  const { invite: i } = props
  return (
    <>
      <tr>
        <td>
          <pre>{i.code}</pre>
        </td>
        <td>
          <pre>{i.created_by_username}</pre>
        </td>
        <td>
          <pre>{i.claimed_by_username}</pre>
        </td>
        <td>
          <PolarTimeAgo date={new Date(i.created_at)} />
        </td>
        <td>
          <p>{i.note}</p>
        </td>
      </tr>
    </>
  )
}
