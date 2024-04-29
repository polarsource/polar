'use client'

import ConfigureAdCampaigns from '@/components/Benefit/ads/ConfigureAdCampaigns'
import { resolveBenefitIcon } from '@/components/Benefit/utils'
import { previewOpts } from '@/components/Feed/Markdown/BrowserRender'
import GitHubIcon from '@/components/Icons/GitHubIcon'
import { Slideshow } from '@/components/Products/Slideshow'
import { useOrganization } from '@/hooks/queries'
import { usePurchase } from '@/hooks/queries/purchases'
import { getCentsInDollarString } from '@/utils/money'
import { organizationPageLink } from '@/utils/nav'
import { BenefitSubscriberInner, SubscriptionSubscriber } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox, {
  ShadowBoxOnMd,
} from 'polarkit/components/ui/atoms/shadowbox'
import { Separator } from 'polarkit/components/ui/separator'

export default function Page() {
  const { id } = useParams()

  const { data: purchase } = usePurchase((id as string) ?? '')

  if (!purchase) {
    return null
  }

  return (
    <div className="flex h-full flex-grow flex-row items-start gap-x-12">
      <div className="flex w-full flex-col gap-8 md:w-full">
        {purchase.product.media.length && (
          <Slideshow images={purchase.product.media} />
        )}
        <ShadowBox className="flex flex-col gap-6 ring-gray-100">
          <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
            <Markdown
              options={{
                ...previewOpts,
                overrides: {
                  ...previewOpts.overrides,
                  a: (props) => (
                    <a {...props} rel="noopener noreferrer nofollow" />
                  ),
                },
              }}
            >
              {purchase.product.description}
            </Markdown>
          </div>
        </ShadowBox>
      </div>
      <div className="flex w-full max-w-[340px] flex-col gap-8">
        <ShadowBox className="flex flex-col gap-8 md:ring-gray-100">
          <h3 className="text-lg font-medium">{purchase.product.name}</h3>
          <div className="flex flex-col gap-4">
            <h1 className="text-5xl font-light text-blue-500 dark:text-blue-400">
              ${getCentsInDollarString(purchase.product.price)}
            </h1>
            <p className="dark:text-polar-500 text-sm text-gray-400">
              Purchased on{' '}
              {new Date(purchase.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth>
              Download Receipt
            </Button>
            <Link
              href={organizationPageLink(
                purchase.product.organization,
                `/products/${purchase.product.id}`,
              )}
            >
              <Button size="lg" variant="ghost" fullWidth>
                Go to Product
              </Button>
            </Link>
          </div>
        </ShadowBox>
        <div className="flex flex-col gap-y-4">
          <h3 className="font-medium">Benefits</h3>
          <div className="flex flex-col gap-y-4">
            {purchase.product.benefits.length > 0 &&
              purchase.product.benefits.map((benefit) => (
                <ShadowBox
                  key={benefit.id}
                  className="flex flex-col gap-4 md:ring-gray-100"
                >
                  <h3 className="font-medium">{benefit.description}</h3>
                  <p className="dark:text-polar-500 text-sm text-gray-400"></p>
                </ShadowBox>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface BenefitContextWidgetProps {
  benefit: BenefitSubscriberInner
  subscription: SubscriptionSubscriber
}

const GitHubRepoWidget = ({ benefit }: BenefitContextWidgetProps) => {
  if (benefit.type !== 'github_repository') {
    return <></>
  }

  const orgName = benefit.properties.repository_owner
  const repoName = benefit.properties.repository_name
  const githubURL = `https://github.com/${orgName}/${repoName}`

  return (
    <>
      <Link href={`${githubURL}/invitations`}>
        <Button variant="outline" asChild>
          <GitHubIcon width={16} height={16} className="mr-2" />
          Go to {orgName}/{repoName}
        </Button>
      </Link>
    </>
  )
}

const BenefitContextWidget = ({
  benefit,
  subscription,
}: BenefitContextWidgetProps) => {
  const { data: org } = useOrganization(benefit?.organization_id ?? '')

  if (!org) {
    return <></>
  }

  return (
    <ShadowBoxOnMd className="sticky top-28 flex w-1/3 flex-col gap-y-6">
      <div className="flex flex-row items-center gap-x-2">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="flex h-6 w-6 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
            {resolveBenefitIcon(benefit, 'inherit')}
          </span>
        </div>
        <h2 className="font-medium capitalize">
          {benefit.type === 'github_repository'
            ? 'GitHub Repository Access'
            : benefit.type}
        </h2>
      </div>
      <p className="dark:text-polar-500 text-sm text-gray-500">
        {benefit.description}
      </p>
      {benefit.type === 'custom' && benefit.properties.note && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950">
          <p className="mb-4 font-medium">Note from {org.name}</p>
          <p className="whitespace-pre-line">{benefit.properties.note}</p>
        </div>
      )}

      {benefit.type === 'github_repository' && (
        <GitHubRepoWidget benefit={benefit} subscription={subscription} />
      )}

      {benefit.type === 'ads' ? (
        <ConfigureAdCampaigns benefit={benefit} subscription={subscription} />
      ) : null}

      <Separator />
      <div className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center gap-x-2">
          <Avatar
            className="h-8 w-8"
            avatar_url={org.avatar_url}
            name={org.name}
          />
          <Link
            className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
            href={organizationPageLink(org)}
          >
            {org.name}
          </Link>
        </div>
      </div>
    </ShadowBoxOnMd>
  )
}
