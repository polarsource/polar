'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useUpdateOrganization } from '@/hooks/queries'
import {
  CheckOutlined,
  HubOutlined,
  ShapeLineOutlined,
} from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type FeatureKey =
  | 'articles_enabled'
  | 'donations_enabled'
  | 'subscriptions_enabled'
  | 'issue_funding_enabled'

type FeatureMap = Partial<Record<FeatureKey, true>>

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const [features, setFeatures] = useState<FeatureKey[]>([])
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()

  const toggleFeature = useCallback(
    (feature: FeatureKey) => () => {
      setFeatures((prev) => {
        if (prev.includes(feature)) {
          return prev.filter((f) => f !== feature)
        }
        return [...prev, feature]
      })
    },
    [setFeatures],
  )

  const initializeFeatures = useCallback(
    (features: FeatureKey[]) => {
      if (!organization) return

      const featuresRecord: FeatureMap = features.reduce(
        (acc, feature) => ({
          ...acc,
          [feature]: true,
        }),
        {},
      )

      updateOrganization
        .mutateAsync({
          id: organization.id,
          settings: {
            ...featuresRecord,
          },
        })
        .then(() => {
          router.refresh()
        })
    },
    [organization, router, updateOrganization],
  )

  return (
    <DashboardBody className="flex max-w-4xl flex-col gap-12 py-12">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold">What describes you best?</h1>
        <p className="dark:text-polar-400 text-gray-600">
          We&apos;ll help you setup the most appropriate monetization tools for
          your usecase
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <OnboardingCard
          title="Open Source Maintainer"
          description="Enable crowdfunding through GitHub Issues, and offer benefits via subscriptions to your supporters"
          icon={<HubOutlined fontSize="large" />}
          onClick={() => {
            setFeatures([
              'issue_funding_enabled',
              'subscriptions_enabled',
              'donations_enabled',
            ])
          }}
          active={(
            [
              'issue_funding_enabled',
              'subscriptions_enabled',
              'donations_enabled',
            ] as FeatureKey[]
          ).every((f) => {
            return features.includes(f)
          })}
        />
        <OnboardingCard
          title="Indie Hacker"
          description="Setup subscriptions to monetize your projects, along with donations & posts"
          icon={<ShapeLineOutlined fontSize="large" />}
          active={(
            [
              'subscriptions_enabled',
              'donations_enabled',
              'articles_enabled',
            ] as FeatureKey[]
          ).every((f) => {
            return features.includes(f)
          })}
          onClick={() => {
            setFeatures([
              'subscriptions_enabled',
              'donations_enabled',
              'articles_enabled',
            ])
          }}
        />
      </div>
      <div className="flex flex-col gap-y-2">
        <FeatureItem
          id="subscriptions_enabled"
          name="Subscriptions"
          description="Offer benefits to your supporters via recurring payments"
          active={features.includes('subscriptions_enabled')}
          onClick={toggleFeature}
        />
        <FeatureItem
          id="donations_enabled"
          name="Donations"
          description="Allow your supporters to say thanks with a donation"
          active={features.includes('donations_enabled')}
          onClick={toggleFeature}
        />
        <FeatureItem
          id="issue_funding_enabled"
          name="Issue Funding"
          description="Enable crowdfunding by allowing pledges to your GitHub issues"
          active={features.includes('issue_funding_enabled')}
          onClick={toggleFeature}
        />
        <FeatureItem
          id="articles_enabled"
          name="Posts"
          description="Reach your supporters with a newsletter by writing about your projects"
          active={features.includes('articles_enabled')}
          onClick={toggleFeature}
        />
      </div>
      <p className="dark:text-polar-500 text-center text-sm text-gray-500">
        Don&apos;t worry - you can enable any of these features later
      </p>
      <Button
        size="lg"
        onClick={() => initializeFeatures(features)}
        className="self-center"
        disabled={features.length === 0}
      >
        Continue
      </Button>
    </DashboardBody>
  )
}

interface OnboardingCardProps {
  title: string
  description: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

const OnboardingCard = ({
  icon,
  title,
  description,
  active,
  onClick,
}: OnboardingCardProps) => {
  return (
    <Card
      className={twMerge(
        'dark:hover:bg-polar-800 dark:ring-polar-800 relative flex h-full flex-col shadow-sm ring-1 transition-colors hover:cursor-pointer hover:bg-gray-50',
        active
          ? 'dark:bg-polar-800 bg-white ring-gray-100'
          : 'dark:bg-polar-900 bg-gray-100 ring-gray-200',
      )}
      onClick={onClick}
    >
      <CardHeader className="relative flex flex-row justify-between gap-x-4 gap-y-8 pb-4">
        <div className="flex flex-col gap-y-8">
          <span
            className={twMerge(
              active
                ? 'text-blue-500 dark:text-blue-400'
                : 'dark:text-polar-600 text-gray-400',
            )}
          >
            {icon}
          </span>
          <h3 className="text-2xl font-bold">{title}</h3>
        </div>
        {active && (
          <Button
            className="absolute right-6 top-6 h-8 w-8"
            size="icon"
            variant={active ? 'default' : 'secondary'}
          >
            <CheckOutlined fontSize="inherit" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="h-full">
        <p className="dark:text-polar-500 text-gray-500">{description}</p>
      </CardContent>
    </Card>
  )
}

interface FeatureItemProps {
  id: FeatureKey
  name: string
  description: string
  active: boolean
  onClick: (key: FeatureKey) => () => void
}

const FeatureItem = ({
  id,
  name,
  description,
  active,
  onClick,
}: FeatureItemProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:hover:bg-polar-800 flex flex-row items-center justify-between gap-4 rounded-2xl bg-gray-200/70 px-6 py-4 transition-colors hover:cursor-pointer hover:bg-gray-50',
        active ? 'dark:bg-polar-700 bg-white shadow-sm' : '',
      )}
      onClick={onClick(id)}
    >
      <div className="flex flex-row items-baseline gap-x-4">
        <span className={twMerge(active && 'font-medium')}>{name}</span>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {description}
        </p>
      </div>
      {active && (
        <Button
          className="h-6 w-6"
          size="icon"
          variant={active ? 'default' : 'secondary'}
        >
          <CheckOutlined fontSize="inherit" />
        </Button>
      )}
    </div>
  )
}
