'use client'

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import { BackofficePledge } from '@polar-sh/sdk'
import Link from 'next/link'
import { ThinButton } from 'polarkit/components/ui/atoms'
import { useBackofficeAllPledges } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const Pledges = () => {
  const pledges = useBackofficeAllPledges()

  const issueList = useMemo(() => {
    const byIssue =
      pledges.data?.reduce(
        (hash: Record<string, Array<BackofficePledge>>, obj) => ({
          ...hash,
          [obj.issue.id]: (hash[obj.issue.id] || []).concat(obj),
        }),
        {},
      ) || {}

    return Object.values(byIssue)
  }, [pledges])

  return (
    <div className="space-y-4">
      {issueList.map((i) => (
        <div>
          <div className="flex gap-2">
            <Link
              className="text-blue-600"
              href={`/backoffice/issue/${i[0].issue.id}`}
            >
              {i[0].issue.repository.organization.name}/
              {i[0].issue.repository.name}#{i[0].issue.number}
            </Link>

            <span>&quot;{i[0].issue.title}&quot;</span>

            {i[0].issue.confirmed_solved_at ? (
              <div className="flex items-center rounded-full  bg-green-400 px-2 text-sm text-white">
                confirmed solved
              </div>
            ) : (
              <div className="flex items-center rounded-full  bg-orange-400 px-2 text-sm text-white">
                not confirmed solved
              </div>
            )}

            {i[0].issue.needs_confirmation_solved ? (
              <div className="flex items-center rounded-full  bg-green-400 px-2 text-sm text-white">
                awaiting confirmation
              </div>
            ) : (
              <div className="flex items-center rounded-full  bg-orange-400 px-2 text-sm text-white">
                not awaiting confirmation
              </div>
            )}

            <ThinButton
              color="gray"
              href={`https://github.com/${i[0].issue.repository.organization.name}/${i[0].issue.repository.name}/issues/${i[0].issue.number}`}
            >
              <span>GitHub</span>
              <ArrowTopRightOnSquareIcon />
            </ThinButton>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {i.map((p) => (
              <div className="flex flex-col" key={p.id}>
                <div className="flex items-center gap-2">
                  <div>
                    ${getCentsInDollarString(p.amount.amount, true, true)} from{' '}
                  </div>
                  {p.pledger?.avatar_url && (
                    <img className="h-6 w-6" src={p.pledger.avatar_url} />
                  )}
                  <div className="underline">
                    {p.pledger?.github_username ||
                      p.pledger_email ||
                      'Anonymous'}
                  </div>
                  <div
                    className={twMerge(
                      'flex items-center rounded-full bg-gray-500 px-2 text-sm text-white',
                      p.state === 'disputed' || p.state === 'charge_disputed'
                        ? '!bg-red-700'
                        : '',
                      p.state === 'pending' ? '!bg-green-700' : '',
                    )}
                  >
                    {p.state}
                  </div>

                  <div
                    className={twMerge(
                      'flex items-center rounded-full bg-gray-500 px-2 text-sm text-white',
                      p.state === 'disputed' || p.state === 'charge_disputed'
                        ? '!bg-red-700'
                        : '',
                      p.state === 'pending' ? '!bg-green-700' : '',
                    )}
                  >
                    {p.type}
                  </div>

                  <ThinButton
                    color="gray"
                    href={`https://dashboard.stripe.com/payments/${p.payment_id}`}
                  >
                    <span>Payment</span>
                    <ArrowTopRightOnSquareIcon />
                  </ThinButton>
                </div>
                {p.disputed_at && (
                  <div className="bg-red-700 p-2">
                    Reason: {p.dispute_reason}
                    <br />
                    At: {p.disputed_at.toString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Pledges
