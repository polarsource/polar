import { UploadImage } from '@/components/Image/Image'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, Plus } from 'lucide-react'
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
  footer?: ReactNode
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
  footer,
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
    <Box
      minHeight="100dvh"
      alignItems={{ base: undefined, lg: 'center' }}
      justifyContent="center"
      backgroundColor={{ base: undefined, lg: 'background-primary' }}
      overflowX="hidden"
      padding={{ base: 'none', lg: '2xl' }}
    >
      <Box
        width="100%"
        maxWidth={{ base: undefined, lg: '80rem' }}
        alignItems="stretch"
        columnGap="2xl"
        backgroundColor={{ base: undefined, lg: 'background-secondary' }}
        borderRadius="l"
        padding={{ base: 'none', lg: 's' }}
        borderWidth={{ base: 0, lg: 1 }}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box
          as="aside"
          display={{ base: 'none', lg: 'flex' }}
          width={320}
          flexShrink={0}
          flexDirection="column"
          justifyContent="between"
          rowGap="2xl"
          padding="2xl"
          paddingBottom="l"
        >
          <Box flexDirection="column" rowGap="3xl">
            {branding}
            {introduction}
            {step && (
              <Box as="ol" flexDirection="column" rowGap="xl">
                {AUTHORIZATION_STEPS.map((authorizationStep, index) => {
                  const isCompleted = index < currentStepIndex
                  const isCurrent = index === currentStepIndex
                  const isClickable = isCompleted && Boolean(onStepSelect)

                  return (
                    <Box
                      as="li"
                      key={authorizationStep.id}
                      display="flex"
                      alignItems="center"
                      columnGap="l"
                      cursor={isClickable ? { base: 'pointer' } : undefined}
                      opacity={
                        isClickable ? { base: 1, hover: 0.7 } : undefined
                      }
                      transitionProperty={isClickable ? 'opacity' : undefined}
                      transitionDuration={isClickable ? 'fast' : undefined}
                      onClick={
                        isClickable
                          ? () => onStepSelect?.(authorizationStep.id)
                          : undefined
                      }
                    >
                      <Box
                        width={32}
                        height={32}
                        flexShrink={0}
                        alignItems="center"
                        justifyContent="center"
                        borderRadius="full"
                        backgroundColor={
                          isCompleted || isCurrent
                            ? 'background-inverse'
                            : undefined
                        }
                        borderWidth={isCompleted ? 0 : 1}
                        borderStyle="solid"
                        borderColor="border-primary"
                      >
                        <Text
                          as="span"
                          variant="caption"
                          color={isCompleted || isCurrent ? 'inverse' : 'muted'}
                        >
                          {isCompleted ? <Check size={14} /> : index + 1}
                        </Text>
                      </Box>
                      <Box flexDirection="column">
                        <Text variant="title">{authorizationStep.title}</Text>
                        <Text color="muted">
                          {isCompleted
                            ? (stepDescriptions?.[authorizationStep.id] ??
                              authorizationStep.description)
                            : authorizationStep.description}
                        </Text>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
          {footer && (
            <Box minHeight={40} alignItems="center">
              {footer}
            </Box>
          )}
        </Box>

        <Box
          as="main"
          flex={1}
          alignSelf={{ base: 'stretch', lg: 'center' }}
          flexDirection="column"
          alignItems="center"
          backgroundColor={{ base: undefined, lg: 'background-primary' }}
          borderRadius={{ base: 'none', lg: 'm' }}
          borderWidth={{ base: 0, lg: 1 }}
          borderStyle="solid"
          borderColor="border-secondary"
          height={{ base: undefined, lg: '48rem' }}
          overflow={{ base: 'visible', lg: 'hidden' }}
        >
          <Box
            width="100%"
            flex={{ base: undefined, lg: 1 }}
            justifyContent="center"
            overflowY={{ base: 'visible', lg: 'auto' }}
            paddingTop={{ base: 'xl', lg: '3xl' }}
            paddingBottom={{ base: '5xl', lg: '3xl' }}
            paddingHorizontal="l"
          >
            <Box
              width="100%"
              maxWidth="28rem"
              flexDirection="column"
              rowGap="2xl"
            >
              <Box
                display={{ base: 'flex', lg: 'none' }}
                flexDirection="column"
                rowGap="xl"
              >
                {branding}
                {introduction}
                {step && (
                  <Box width="100%" alignItems="center" gap="s">
                    {AUTHORIZATION_STEPS.map((authorizationStep, index) => (
                      <Box key={authorizationStep.id} flex={1}>
                        <Box
                          display="block"
                          height={2}
                          width="100%"
                          borderRadius="full"
                          backgroundColor={
                            index <= currentStepIndex
                              ? 'background-inverse'
                              : 'background-card'
                          }
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {(contentTitle || contentSubtitle) && (
                <Box flexDirection="column" rowGap="m">
                  {contentTitle && (
                    <Text variant="heading-xs">{contentTitle}</Text>
                  )}
                  {contentSubtitle && (
                    <Text variant="body" color="muted">
                      {contentSubtitle}
                    </Text>
                  )}
                </Box>
              )}

              {children}
            </Box>
          </Box>

          {(actions || actionsContainerRef) && (
            <Box
              width="100%"
              flexShrink={0}
              justifyContent="center"
              position={{ base: 'fixed', lg: 'static' }}
              bottom={0}
              left={0}
              right={0}
              zIndex={10}
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-secondary"
              backgroundColor="background-primary"
              padding="l"
            >
              <Box ref={actionsContainerRef} width="100%" justifyContent="end">
                {actions}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
