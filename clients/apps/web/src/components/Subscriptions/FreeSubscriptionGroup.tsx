import { Edit } from '@mui/icons-material'
import { Organization, SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'

interface FreeSubscriptionGroupProps {
  title: string
  description: string
  tier: SubscriptionTier & { type: 'free' }
  organization: Organization
}

const FreeSubscriptionGroup: React.FC<FreeSubscriptionGroupProps> = ({
  title,
  description,
  tier,
  organization,
}) => {
  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex flex-row items-center text-2xl">
            <SubscriptionGroupIcon type={tier.type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-3">{title}</span>
          </h2>
          <p className="dark:text-polar-500 mt-4 text-gray-400">
            {description}
          </p>
        </div>
        <Link
          href={`/maintainer/${organization.name}/subscriptions/tiers/${tier.id}`}
        >
          <Button>
            <Edit className="mr-2" fontSize="small" />
            Edit
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default FreeSubscriptionGroup
