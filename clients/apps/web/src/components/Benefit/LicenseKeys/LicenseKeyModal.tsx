'use client'

import { CustomerCell } from '@/components/Customer/CustomerCell'
import { CopyButton } from '@/components/Events/CopyButton'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { toast } from '@/components/Toast/use-toast'
import { useLicenseKeyUpdate } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import {
  Button,
  InlineModalHeader,
  Status,
  StatusColor,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, RefreshCw } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { ReactNode, useCallback, useState } from 'react'
import { LicenseKeyActivationList } from './LicenseKeyActivationList'

const STATUS_LABELS: Record<schemas['LicenseKeyStatus'], string> = {
  granted: 'Granted',
  disabled: 'Disabled',
  revoked: 'Revoked',
}

const STATUS_COLORS: Record<schemas['LicenseKeyStatus'], StatusColor> = {
  granted: 'green',
  disabled: 'yellow',
  revoked: 'red',
}

const DetailStat = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <Box alignItems="center" justifyContent="between" columnGap="l">
    <Text color="muted">{label}</Text>
    <Text tabularNums truncate>
      {children}
    </Text>
  </Box>
)

export const LicenseKeyModal = ({
  organization,
  licenseKey,
  onClose,
  onRotate,
}: {
  organization: schemas['Organization']
  licenseKey: schemas['LicenseKeyWithActivations']
  onClose: () => void
  onRotate: () => Promise<void>
}) => {
  const [statusLoading, setStatusLoading] = useState(false)
  const [isRevokeConfirmShown, setIsRevokeConfirmShown] = useState(false)
  const [isRotateConfirmShown, setIsRotateConfirmShown] = useState(false)
  const updateLicenseKey = useLicenseKeyUpdate(organization.id)

  const handleToggleLicenseKeyStatus = useCallback(
    async (status: 'granted' | 'disabled' | 'revoked') => {
      setStatusLoading(true)
      await updateLicenseKey
        .mutateAsync(
          {
            id: licenseKey.id,
            body: {
              status,
              usage: licenseKey.usage,
            },
          },
          {
            onSettled: () => {
              setStatusLoading(false)
            },
          },
        )
        .then(({ error }) => {
          if (error) {
            toast({
              title: 'License key status update failed',
              description: `Error updating license key status to ${status}: ${extractApiErrorMessage(error)}`,
            })
            return
          }
          toast({
            title: 'License key status updated',
            description: `License key ending in ${licenseKey.display_key} updated to ${status}`,
          })
        })
    },
    [updateLicenseKey, licenseKey],
  )

  const { customer } = licenseKey

  return (
    <Box flexDirection="column" overflowY="auto">
      <InlineModalHeader hide={onClose}>
        <Text variant="heading-xxs" as="h1">
          License key
        </Text>
      </InlineModalHeader>
      <Box
        flexDirection="column"
        rowGap="2xl"
        paddingHorizontal="2xl"
        paddingBottom="2xl"
      >
        <Box
          flexDirection="column"
          rowGap="xl"
          minWidth={0}
          marginHorizontal="-2xl"
          paddingHorizontal="2xl"
          paddingBottom="2xl"
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <Box minWidth={0} alignItems="center" columnGap="s">
            <Box
              flexGrow={1}
              minWidth={0}
              alignItems="center"
              columnGap="xs"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              borderRadius="m"
              backgroundColor="background-primary"
              paddingLeft="l"
              paddingRight="s"
              height={40}
            >
              <Box flexGrow={1} minWidth={0}>
                <Text monospace truncate>
                  {licenseKey.key}
                </Text>
              </Box>
              <span className="contents [&_button]:size-7 [&_button_svg]:size-3.5!">
                <CopyButton value={licenseKey.key} label="Copy license key" />
              </span>
            </Box>
            {licenseKey.status !== 'revoked' && (
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-10 shrink-0 border-gray-200 [&_svg]:size-4!"
                    aria-label="Rotate license key"
                    onClick={() => setIsRotateConfirmShown(true)}
                  >
                    <RefreshCw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate license key</TooltipContent>
              </Tooltip>
            )}
          </Box>
          <Link
            href={buildCustomerDashboardPath(organization.slug, customer)}
            className="group"
          >
            <Box alignItems="center" justifyContent="between" columnGap="m">
              <CustomerCell
                name={customer.name}
                email={customer.email}
                avatarUrl={customer.avatar_url}
              />
              <ChevronRight className="dark:text-polar-500 h-4 w-4 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </Box>
          </Link>
        </Box>
        <Box flexDirection="column" rowGap="m">
          <Box alignItems="center" justifyContent="between" columnGap="l">
            <Text color="muted">Status</Text>
            <Status
              size="small"
              color={STATUS_COLORS[licenseKey.status]}
              status={STATUS_LABELS[licenseKey.status]}
            />
          </Box>
          {licenseKey.limit_usage && (
            <DetailStat label="Usage">
              {licenseKey.usage} / {licenseKey.limit_usage}
            </DetailStat>
          )}
          <DetailStat label="Validations">{licenseKey.validations}</DetailStat>
          <DetailStat label="Last validated">
            {licenseKey.last_validated_at ? (
              <FormattedDateTime datetime={licenseKey.last_validated_at} />
            ) : (
              'Never'
            )}
          </DetailStat>
          <DetailStat label="Expires">
            {licenseKey.expires_at ? (
              <FormattedDateTime datetime={licenseKey.expires_at} />
            ) : (
              'Never'
            )}
          </DetailStat>
        </Box>
      </Box>
      <LicenseKeyActivationList licenseKey={licenseKey} />
      <Box
        justifyContent="end"
        columnGap="l"
        flexWrap="wrap"
        rowGap="l"
        paddingHorizontal="2xl"
        paddingBottom="2xl"
      >
        {['disabled', 'revoked'].includes(licenseKey.status) && (
          <Button
            onClick={() => handleToggleLicenseKeyStatus('granted')}
            loading={statusLoading}
          >
            Enable
          </Button>
        )}
        {licenseKey.status === 'granted' && (
          <Button
            onClick={() => handleToggleLicenseKeyStatus('disabled')}
            variant="secondary"
            loading={statusLoading}
          >
            Disable
          </Button>
        )}
        {licenseKey.status === 'granted' && (
          <Button
            onClick={() => setIsRevokeConfirmShown(true)}
            loading={statusLoading}
            variant="destructive"
          >
            Revoke
          </Button>
        )}
      </Box>
      <ConfirmModal
        isShown={isRevokeConfirmShown}
        hide={() => setIsRevokeConfirmShown(false)}
        title="Revoke this license key?"
        description="The key stops validating right away."
        destructive
        destructiveText="Revoke"
        onConfirm={() => handleToggleLicenseKeyStatus('revoked')}
      />
      <ConfirmModal
        isShown={isRotateConfirmShown}
        hide={() => setIsRotateConfirmShown(false)}
        title="Rotate this license key?"
        description="A new key will be generated for this customer. The previous key stops validating immediately. Share the new key with your customer, or have them copy it from the customer portal."
        destructive
        destructiveText="Rotate"
        onConfirm={onRotate}
      />
    </Box>
  )
}
