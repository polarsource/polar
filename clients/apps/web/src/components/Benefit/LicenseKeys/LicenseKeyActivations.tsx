import { useLicenseKey, useLicenseKeyDeactivation } from '@/hooks/queries'
import { CloseOutlined } from '@mui/icons-material'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'

interface LicenseKeyActivationsProps {
  licenseKeyId: string
}

export const LicenseKeyActivations = ({
  licenseKeyId,
}: LicenseKeyActivationsProps) => {
  const { data: licenseKey } = useLicenseKey({ licenseKeyId })

  const onDeactivate = useLicenseKeyDeactivation(licenseKeyId)

  const hasActivations = (licenseKey?.activations?.length ?? 0) > 0

  if (!hasActivations) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <h3>Activations</h3>
      <List size="small">
        {licenseKey?.activations.map((activation) => (
          <ListItem key={activation.id} size="small">
            <h3 className="text-sm">{activation.label}</h3>
            <div className="flex flex-row items-center gap-x-4">
              <span className="dark:text-polar-500 text-sm text-gray-500">
                <FormattedDateTime datetime={activation.created_at} />
              </span>
              <Button
                className="h-6 w-6"
                variant="secondary"
                size="icon"
                onClick={() => {
                  onDeactivate.mutate({
                    activationId: activation.id,
                    key: licenseKey.key,
                    organizationId: licenseKey.organization_id,
                  })
                }}
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
