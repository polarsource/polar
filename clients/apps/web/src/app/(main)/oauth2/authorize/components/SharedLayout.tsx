import { OnboardingLayout } from '@/components/Layout/OnboardingLayout'
import { UploadImage } from '@/components/Image/Image'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Plus } from 'lucide-react'
import type { ReactNode, Ref } from 'react'

type AuthorizationStep = 'create' | 'organizations' | 'scopes'
type SelectableAuthorizationStep = Exclude<AuthorizationStep, 'create'>

const AUTHORIZATION_STEP_CONTENT = {
  create: {
    title: 'Create an organization',
    description: 'Set up your organization to continue.',
  },
  organizations: {
    title: 'Select organizations',
    description: 'Choose which organizations you want to grant access to.',
  },
  scopes: {
    title: 'Review requested scopes',
    description:
      'Review the permissions this application is requesting before granting access.',
  },
} as const

const AUTHORIZATION_STEPS = [
  {
    id: 'organizations',
    title: 'Organizations',
    description: 'Select organizations to share',
  },
  {
    id: 'scopes',
    title: 'Permissions',
    description: 'Review scopes to grant',
  },
] as const

interface SharedLayoutProps {
  client?: schemas['AuthorizeResponseOrganization']['client']
  introduction?: ReactNode
  step?: AuthorizationStep
  onStepSelect?: (step: SelectableAuthorizationStep) => void
  stepDescriptions?: Partial<Record<SelectableAuthorizationStep, ReactNode>>
  title?: string
  subtitle?: string
  actions?: ReactNode
  actionsContainerRef?: Ref<HTMLElement>
  children?: ReactNode
}

export default function SharedLayout({
  client,
  introduction,
  step,
  onStepSelect,
  stepDescriptions,
  title,
  subtitle,
  actions,
  actionsContainerRef,
  children,
}: SharedLayoutProps) {
  const selectableStep = step === 'create' ? 'organizations' : step
  const currentStepIndex = selectableStep
    ? AUTHORIZATION_STEPS.findIndex(({ id }) => id === selectableStep)
    : -1
  const stepContent = step ? AUTHORIZATION_STEP_CONTENT[step] : undefined
  const contentTitle = title ?? stepContent?.title
  const contentSubtitle = subtitle ?? stepContent?.description
  const branding = (
    <Box alignItems="center" gap="m">
      <Box color="text-primary">
        <PolarLogotype logoVariant="logotype" logoClassName="ml-0" />
      </Box>
      {client?.logo_uri && (
        <>
          <Plus size={18} />
          <UploadImage
            src={client.logo_uri}
            approximateWidth={40}
            className="h-10"
            alt={client.client_name ?? client.client_id}
          />
        </>
      )}
    </Box>
  )

  return (
    <OnboardingLayout
      branding={branding}
      introduction={introduction}
      steps={step ? AUTHORIZATION_STEPS : undefined}
      currentStepIndex={currentStepIndex}
      onStepSelect={onStepSelect}
      stepDescriptions={stepDescriptions}
      title={contentTitle}
      subtitle={contentSubtitle}
      actions={actions}
      actionsContainerRef={actionsContainerRef}
    >
      {children}
    </OnboardingLayout>
  )
}
