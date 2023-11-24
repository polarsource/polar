import LongformPost from '@/components/Feed/LongformPost'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Article, Organization, SubscriptionSummary } from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoType } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'

export default function Page({
  post,
  organization,
  subscribersCount,
  subscriptionSummary,
}: {
  post: Article
  organization: Organization
  subscribersCount: number
  subscriptionSummary: SubscriptionSummary[]
}) {
  return (
    <div className="flex w-full flex-col items-center gap-y-16">
      <div className="flex w-full flex-row items-center justify-between px-4">
        <Link href="/">
          <LogoType />
        </Link>
        <div>
          <ProfileMenu />
        </div>
      </div>
      <div className="relative flex w-full flex-col gap-x-24 px-4 pb-16 md:flex-row">
        <OrganizationPublicSidebar
          organization={organization}
          subscribersCount={subscribersCount}
          subscriptionSummary={subscriptionSummary}
        />
        <div className="dark:bg-polar-800 dark:border-polar-700 relative flex w-full flex-col items-center rounded-3xl bg-white p-12 shadow-xl dark:border">
          <Link className="absolute left-16 top-16 flex-shrink" href="/posts">
            <Button
              size="sm"
              variant="secondary"
              className="group flex h-8 w-8 flex-col items-center justify-center rounded-full border"
            >
              <ArrowBackOutlined fontSize="inherit" />
            </Button>
          </Link>
          <LongformPost post={post} />
        </div>
      </div>
    </div>
  )
}
