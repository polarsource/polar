'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useLicenseKeyRotate, useLicenseKeyUpdate } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { Avatar, Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useCallback, useState } from 'react'
import { LicenseKeyDetails } from './LicenseKeyDetails'

export const LicenseKeyModal = ({
  organization,
  licenseKey,
  onClose,
  locale = DEFAULT_LOCALE,
}: {
  organization: schemas['Organization']
  licenseKey: schemas['LicenseKeyWithActivations'] | schemas['LicenseKeyRead']
  onClose: () => void
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale)
  const [statusLoading, setStatusLoading] = useState(false)
  const [rotateLoading, setRotateLoading] = useState(false)
  const updateLicenseKey = useLicenseKeyUpdate(organization.id)
  const rotateLicenseKey = useLicenseKeyRotate(organization.id)
  const {
    isShown: isRotateConfirmShown,
    show: showRotateConfirm,
    hide: hideRotateConfirm,
  } = useModal()

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

  const handleRotate = useCallback(async () => {
    setRotateLoading(true)
    await rotateLicenseKey
      .mutateAsync(licenseKey.id, {
        onSettled: () => {
          setRotateLoading(false)
        },
      })
      .then(({ error }) => {
        if (error) {
          toast({
            title: t('checkout.benefits.licenseKey.rotateFailedTitle'),
            description: extractApiErrorMessage(error),
          })
          return
        }
        toast({
          title: t('checkout.benefits.licenseKey.rotateSuccessTitle'),
          description: t(
            'checkout.benefits.licenseKey.rotateSuccessDescription',
          ),
        })
      })
  }, [rotateLicenseKey, licenseKey.id, t])

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
                title: t('checkout.benefits.licenseKey.copiedToClipboard'),
                description: t(
                  'checkout.benefits.licenseKey.copiedToClipboardDescription',
                ),
              })
            }}
          />
          <LicenseKeyDetails licenseKey={licenseKey} locale={locale} />
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
            <Button
              onClick={showRotateConfirm}
              variant="secondary"
              loading={rotateLoading}
            >
              {t('checkout.benefits.licenseKey.rotate')}
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
      <ConfirmModal
        isShown={isRotateConfirmShown}
        hide={hideRotateConfirm}
        title={t('checkout.benefits.licenseKey.rotateConfirmTitle')}
        description={t('checkout.benefits.licenseKey.rotateConfirmDescription')}
        destructive
        destructiveText={t('checkout.benefits.licenseKey.rotate')}
        onConfirm={handleRotate}
      />
    </Box>
  )
}
