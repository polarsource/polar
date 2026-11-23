import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { toast } from '@/components/Toast/use-toast'
import { useLicenseKeyActivationDeactivate } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CloseOutlined } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useState } from 'react'

export const LicenseKeyActivationList = ({
  licenseKey,
}: {
  licenseKey: schemas['LicenseKeyWithActivations']
}) => {
  const [activationToDeactivate, setActivationToDeactivate] =
    useState<schemas['LicenseKeyActivationBase']>()
  const deactivate = useLicenseKeyActivationDeactivate(licenseKey)

  const handleDeactivate = async () => {
    if (!activationToDeactivate) {
      return
    }
    const { error } = await deactivate
      .mutateAsync(activationToDeactivate.id)
      .catch(() => ({ error: {} }))
    if (error) {
      toast({
        title: 'Deactivation failed',
        description: extractApiErrorMessage(error),
      })
      return
    }
    toast({
      title: 'Activation deactivated',
      description: `${activationToDeactivate.label} no longer counts toward the activation limit`,
    })
  }

  return (
    <Box
      flexDirection="column"
      paddingHorizontal="2xl"
      paddingVertical="xl"
      rowGap="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Box alignItems="center" justifyContent="between" minHeight={32}>
        <Text as="h2">Activations</Text>
        {licenseKey.limit_activations && (
          <Text color="muted" tabularNums>
            {licenseKey.activations.length} of {licenseKey.limit_activations}{' '}
            used
          </Text>
        )}
      </Box>
      {licenseKey.activations.length > 0 ? (
        <List size="small">
          {licenseKey.activations.map((activation) => (
            <ListItem key={activation.id} size="small">
              <Box flexDirection="column" minWidth={0}>
                <Text truncate>{activation.label}</Text>
                {Object.entries(activation.meta).map(([key, value]) => (
                  <Text key={key} variant="caption" color="muted" truncate>
                    {key}: {String(value)}
                  </Text>
                ))}
              </Box>
              <Box alignItems="center" columnGap="m" flexShrink={0}>
                <Text variant="caption" color="muted">
                  <FormattedDateTime datetime={activation.created_at} />
                </Text>
                <Button
                  className="h-6 w-6"
                  variant="ghost"
                  size="icon"
                  aria-label={`Deactivate ${activation.label}`}
                  onClick={() => setActivationToDeactivate(activation)}
                >
                  <CloseOutlined fontSize="inherit" />
                </Button>
              </Box>
            </ListItem>
          ))}
        </List>
      ) : (
        <Text color="muted">No activations</Text>
      )}
      <ConfirmModal
        isShown={!!activationToDeactivate}
        hide={() => setActivationToDeactivate(undefined)}
        title="Deactivate this activation?"
        description="It stops counting toward the activation limit. Validations that use this activation will fail until the customer activates again."
        destructive
        destructiveText="Deactivate"
        onConfirm={handleDeactivate}
      />
    </Box>
  )
}
