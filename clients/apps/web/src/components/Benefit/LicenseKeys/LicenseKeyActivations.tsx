import { toast } from '@/components/Toast/use-toast'
import { useCustomerLicenseKeyDeactivate } from '@/hooks/queries'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Client, schemas } from '@polar-sh/client'
import { type AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { useCallback } from 'react'

interface LicenseKeyActivationsProps {
  api: Client
  licenseKey: schemas['LicenseKeyWithActivations']
  locale?: AcceptedLocale
}

export const LicenseKeyActivations = ({
  api,
  licenseKey,
  locale,
}: LicenseKeyActivationsProps) => {
  const resolvedLocale = locale ?? 'en'
  const t = useTranslations(resolvedLocale)
  const onDeactivate = useCustomerLicenseKeyDeactivate(api, licenseKey.id)

  const handleDeactivateActivation = useCallback(
    (activationId: string) => () => {
      onDeactivate
        .mutateAsync({
          activationId,
          key: licenseKey.key,
          organizationId: licenseKey.organization_id,
        })
        .then(() => {
          toast({
            title: t('checkout.benefits.licenseKey.activationDeleted'),
            description: t('checkout.benefits.licenseKey.activationDeletedDescription'),
          })
        })
        .catch((error) => {
          toast({
            title: t('checkout.benefits.licenseKey.activationDeactivationFailed'),
            description: `${error.message}`,
          })
        })
    },
    [onDeactivate, licenseKey, t],
  )

  const hasActivations = (licenseKey?.activations?.length ?? 0) > 0

  if (!hasActivations) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <h3>{t('checkout.benefits.licenseKey.activations')}</h3>
      <List size="small">
        {licenseKey?.activations.map((activation) => (
          <ListItem key={activation.id} size="small">
            <h3 className="text-sm">{activation.label}</h3>
            <div className="flex flex-row items-center gap-x-4">
              <span className="dark:text-polar-500 text-sm text-gray-500">
                <FormattedDateTime datetime={activation.created_at} locale={resolvedLocale} />
              </span>
              <Button
                className="h-6 w-6"
                variant="secondary"
                size="icon"
                onClick={handleDeactivateActivation(activation.id)}
              >
                <CloseOutlined fontSize="inherit" />
              </Button>
            </div>
          </ListItem>
        ))}
      </List>
    </div>
  )
}
