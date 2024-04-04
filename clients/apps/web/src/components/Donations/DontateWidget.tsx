import { VolunteerActivism } from '@mui/icons-material'
import { Organization, Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { organizationPageLink } from 'polarkit/utils/nav'

export interface DonateWidgetProps {
  organization: Organization
  repository?: Repository
}

export const DonateWidget = ({
  organization,
  repository,
}: DonateWidgetProps) => {
  return (
    <div className="flex flex-row gap-y-8 rounded-3xl bg-gradient-to-bl from-blue-400 to-blue-100 p-6 text-white dark:from-blue-400 dark:to-blue-950">
      <div className="flex w-full flex-col gap-y-6">
        <h3 className="text-lg leading-snug [text-wrap:balance]">
          Support{' '}
          {repository
            ? repository.name
            : organization.pretty_name ?? organization.name}{' '}
          with a donation
        </h3>
        <Link href={organizationPageLink(organization, 'donate')}>
          <Button size="sm">
            <div className="flex flex-row items-center gap-2">
              <VolunteerActivism fontSize="inherit" />
              <span>Donate</span>
            </div>
          </Button>
        </Link>
      </div>
    </div>
  )
}
