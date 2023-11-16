'use client'

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import { Button } from 'polarkit/components/ui/atoms'
import {
  useBackofficeIssue,
  useBackofficePledgeRewardTransfer,
  useBackofficeRewards,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { twMerge } from 'tailwind-merge'

export default function Page({ params }: { params: { id: string } }) {
  const id = params.id

  const issue = useBackofficeIssue(typeof id === 'string' ? id : undefined)

  const rewards = useBackofficeRewards(typeof id === 'string' ? id : undefined)
  const rewardsData = rewards.data?.items || []

  const pledgeRewardCreateTransfer = useBackofficePledgeRewardTransfer()

  const createTransfer = async (pledgeId: string, issueRewardId: string) => {
    try {
      await pledgeRewardCreateTransfer.mutateAsync({
        pledgeId,
        issueRewardId,
      })
    } catch (e) {
      alert(JSON.stringify(e, null, 2))
    }
  }

  return (
    <div>
      <h2 className="text-2xl">Issue</h2>
      <table>
        <tbody>
          <tr>
            <td className="font-bold">Issue</td>
            <td>
              <a
                className="text-blue-500"
                href={`https://github.com/${issue.data?.repository.organization.name}/${issue.data?.repository.name}/issues/${issue.data?.number}`}
              >
                {issue.data?.title}
              </a>
            </td>
          </tr>
          <tr>
            <td className="font-bold">State</td>
            <td>{issue.data?.state}</td>
          </tr>
          <tr>
            <td className="font-bold">Funding</td>
            <td>
              <pre>{JSON.stringify(issue.data?.funding, null, 0)}</pre>
            </td>
          </tr>
        </tbody>
      </table>
      <h3 className="mt-9 text-xl">Rewards</h3>
      <div className="flex flex-col gap-2">
        {rewardsData.map((r) => (
          <div className="flex gap-2" key={r.issue_reward_id}>
            <div>
              ${getCentsInDollarString(r.amount.amount, true, true)}{' '}
              <span className="text-gray-500">
                (of $
                {getCentsInDollarString(r.pledge.amount.amount, true, true)})
              </span>{' '}
              to
            </div>
            {r.user && (
              <div>
                <span className="underline">{r.user.username}</span> [user]
              </div>
            )}
            {r.organization && (
              <div>
                <span className="underline">{r.organization.name}</span> [org]
              </div>
            )}
            <div>
              from{' '}
              <span className="underline">
                {r.pledge.pledger?.name || 'Anonymous'}
              </span>
            </div>
            <div
              className={twMerge(
                'flex items-center rounded-full bg-gray-500 px-2 text-sm text-white',
                r.state === 'pending' ? '!bg-blue-700' : '',
                r.state === 'paid' ? '!bg-green-700' : '',
              )}
            >
              {r.state}
            </div>
            {r.transfer_id && (
              <a
                href={`https://dashboard.stripe.com/connect/transfers/${r.transfer_id}`}
              >
                <Button size="sm">
                  <span>Transfer</span>
                  <ArrowTopRightOnSquareIcon />
                </Button>
              </a>
            )}
            {!r.transfer_id && (
              <Button
                size="sm"
                onClick={() => createTransfer(r.pledge.id, r.issue_reward_id)}
              >
                <span>Create Transfer</span>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
