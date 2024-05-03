'use client'

import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useUpdateOrganization } from '@/hooks/queries'
import {
  ArrowForward,
  HubOutlined,
  ShapeLineOutlined,
} from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useCallback, useRef } from 'react'
import { useHoverDirty } from 'react-use'

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
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()

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
    <DashboardBody className="flex max-w-4xl flex-col gap-16 py-24">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-medium">What describes you best?</h1>
        <p className="dark:text-polar-400 text-gray-600">
          We&apos;ll help you setup the most appropriate monetization tools for
          your usecase
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <OnboardingCard
          title="Open Source Maintainer"
          description="Enable crowdfunding through GitHub Issues, and offer benefits via subscriptions to your supporters"
          icon={
            <HubOutlined
              className="text-blue-500 dark:text-blue-400"
              fontSize="large"
            />
          }
          onClick={() => {}}
        />
        <OnboardingCard
          title="Indie Hacker"
          description="Setup subscriptions to monetize your projects, along with donations & posts"
          icon={
            <ShapeLineOutlined
              className="text-blue-500 dark:text-blue-400"
              fontSize="large"
            />
          }
          onClick={() => {}}
        />
      </div>
    </DashboardBody>
  )
}

interface OnboardingCardProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}

const OnboardingCard = ({
  icon,
  title,
  description,
  onClick,
}: OnboardingCardProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useHoverDirty(ref)

  return (
    <Card
      ref={ref}
      className="dark:hover:bg-polar-800 relative flex h-full flex-col transition-colors hover:cursor-pointer hover:bg-gray-50"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row justify-between gap-x-4 gap-y-8">
        <div className="flex flex-col gap-y-8">
          {icon}
          <h3 className="text-2xl font-bold">{title}</h3>
        </div>
        <AnimatedIconButton
          variant={isHovered ? 'default' : 'secondary'}
          active={isHovered}
        >
          <ArrowForward fontSize="inherit" />
        </AnimatedIconButton>
      </CardHeader>
      <CardContent className="h-full">
        <p className="dark:text-polar-500 text-gray-500">{description}</p>
      </CardContent>
    </Card>
  )
}
