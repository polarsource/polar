import { useAuth } from '@/hooks'
import { useRedirectToGitHubInstallation } from '@/hooks/github'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { Banner } from 'polarkit/components/ui/molecules'
import { PropsWithChildren } from 'react'

export const MaintainerUpsell = () => {
  return (
    <Upsell
      title="Become a creator"
      description="Build, engage & convert your own community of free- and paid subscribers."
    >
      <Link href="/dashboard/create">
        <Button size="sm" className="-z-1 self-start" type="button">
          <span>Get Started</span>
          <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
        </Button>
      </Link>
    </Upsell>
  )
}

export const SetupProductsUpsell = () => {
  const { userOrganizations: organizations } = useAuth()
  const firstOrg = organizations[0]

  if (!firstOrg) {
    return null
  }

  return (
    <Upsell
      title="Create & Promote Products"
      description="Monetize your projects by selling digital products, subscriptions, and services to your community."
    >
      <Link href={`/dashboard/${firstOrg.slug}/products`}>
        <Button size="sm" className="-z-1">
          <span>Get Started</span>
          <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
        </Button>
      </Link>
    </Upsell>
  )
}

export const Upsell = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) => {
  return (
    <div className="dark:border-polar-700 dark:text-polar-400 rounded-4xl dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50 p-6">
      <h3 className="text-lg font-medium text-gray-950 dark:text-white">
        {title}
      </h3>
      <p className="dark:text-polar-300 -mt-2 text-sm text-gray-500">
        {description}
      </p>
      {children}
    </div>
  )
}

export const GitHubAppInstallationUpsell = ({
  organization,
}: {
  organization: Organization
}) => {
  const redirectToGitHubInstallation =
    useRedirectToGitHubInstallation(organization)
  return (
    <>
      <Banner
        color="default"
        right={
          <Button size="sm" onClick={redirectToGitHubInstallation}>
            Install GitHub App
          </Button>
        }
      >
        <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
        <span className="text-sm">
          Install our <strong>GitHub App</strong> on at least one of your
          repositories to enable this feature.
        </span>
      </Banner>
    </>
  )
}
