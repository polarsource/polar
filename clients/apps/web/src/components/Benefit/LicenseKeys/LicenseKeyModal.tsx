'use client'

import { toast } from '@/components/Toast/use-toast'
import { useLicenseKeyUpdate } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Avatar, Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useCallback, useState } from 'react'
import { LicenseKeyDetails } from './LicenseKeyDetails'

export const LicenseKeyModal = ({
  organization,
  licenseKey,
  onClose,
  onRotate,
}: {
  organization: schemas['Organization']
  licenseKey: schemas['LicenseKeyWithActivations'] | schemas['LicenseKeyRead']
  onClose: () => void
  onRotate: () => void
}) => {
  const [statusLoading, setStatusLoading] = useState(false)
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
              title: 'License Key Status Update Failed',
              description: `Error updating license key status to ${status}: ${extractApiErrorMessage(error)}`,
            })
            return
          }
          toast({
            title: 'License Key Status Updated',
            description: `License key ending in ${licenseKey.display_key} updated to ${status}`,
          })
        })
    },
    [updateLicenseKey, licenseKey],
  )

  return (
    <Box flexDirection="column" overflowY="auto">
      <InlineModalHeader hide={onClose}>
        <Text variant="heading-xxs" as="h1">
          License Key
        </Text>
      </InlineModalHeader>
      <Box
        flexDirection="column"
        rowGap="2xl"
        paddingHorizontal="2xl"
        paddingBottom="2xl"
      >
        <Box alignItems="center" columnGap="m">
          <Avatar
            className="h-10 w-10"
            avatar_url={licenseKey.customer.avatar_url}
            name={licenseKey.customer.email ?? licenseKey.customer.name ?? '—'}
          />
          <Box flexDirection="column">
            <Text>{licenseKey.customer.email ?? '—'}</Text>
          </Box>
        </Box>
        <Box flexDirection="column" rowGap="xl">
          <CopyToClipboardInput
            value={licenseKey.key}
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `License Key was copied to clipboard`,
              })
            }}
          />
          <LicenseKeyDetails licenseKey={licenseKey} />
        </Box>
        <Box columnGap="l" flexWrap="wrap" rowGap="l">
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
          {(licenseKey.status === 'granted' ||
            licenseKey.status === 'disabled') && (
            <Button onClick={onRotate} variant="secondary">
              Rotate
            </Button>
          )}
          {licenseKey.status === 'granted' && (
            <Button
              onClick={() => handleToggleLicenseKeyStatus('revoked')}
              loading={statusLoading}
              variant="destructive"
            >
              Revoke
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}
