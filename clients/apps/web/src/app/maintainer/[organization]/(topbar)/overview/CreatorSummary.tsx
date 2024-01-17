import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar, Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useSubscriptionSummary } from 'polarkit/hooks'

export interface CreatorSummaryProps {
  organization: Organization
}

export const CreatorSummary = ({ organization }: CreatorSummaryProps) => {
  const { data: subscriptions } = useSubscriptionSummary(
    organization.name,
    9999,
  )

  const subsciberCount = subscriptions?.pagination.total_count ?? 0

  return (
    <ShadowBoxOnMd>
      <div className="flex flex-col justify-between gap-y-8 md:flex-row md:items-center md:p-4">
        <div className="flex flex-row items-center gap-8">
          <Avatar
            className="h-24 w-24"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
          <div className="flex flex-col gap-y-2">
            <h1 className="text-2xl">
              {organization.pretty_name ?? organization.name}
            </h1>
            <div className="dark:text-polar-500 flex flex-row items-center gap-x-2 text-gray-500">
              <span>
                {subsciberCount}{' '}
                {subsciberCount === 1 ? 'Subscriber' : 'Subscribers'}
              </span>
            </div>
          </div>
        </div>
        <Link className="flex flex-row" href={`/${organization.name}`}>
          <div className="hidden flex-row items-center gap-x-2 md:flex">
            <span>Public Page</span>
            <ArrowUpRightIcon className="h-6 w-6" />
          </div>
          <Button className="md:hidden" size="lg" fullWidth>
            <span>View Public Page</span>
          </Button>
        </Link>
      </div>
    </ShadowBoxOnMd>
  )
}
