import { useMetrics } from '@/hooks/queries/metrics'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { AddOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { PropsWithChildren, useCallback, useContext, useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import AmountLabel from '../Shared/AmountLabel'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'
import { EditCustomerModal } from './EditCustomerModal'

const CustomerStatBox = ({
  title,
  children,
}: PropsWithChildren<{ title: string }>) => {
  return (
    <div className="dark:bg-polar-800 flex flex-1 flex-col gap-1 rounded-lg bg-gray-100 px-4 py-3 text-sm">
      <span className="dark:text-polar-500 text-gray-500">{title}</span>
      {children}
    </div>
  )
}

interface CustomerContextViewProps {
  customer: schemas['Customer']
}

export const CustomerContextView = ({ customer }: CustomerContextViewProps) => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const { isShown: isModalShown, show: showModal, hide: hideModal } = useModal()

  const [customerSessionLoading, setCustomerSessionLoading] = useState(false)
  const [customerSessionError, setCustomerSessionError] = useState<
    string | null
  >(null)
  const [customerSession, setCustomerSession] = useState<
    schemas['CustomerSession'] | null
  >(null)
  const createCustomerSession = useCallback(async () => {
    setCustomerSessionLoading(true)
    const { data: session, error } = await api.POST('/v1/customer-sessions/', {
      body: { customer_id: customer.id },
    })
    setCustomerSessionLoading(false)
    if (error) {
      setCustomerSessionError(
        'An error occurred while creating the customer portal link. Please try again later.',
      )
      return
    }
    setCustomerSession(session)
  }, [customer])

  const metrics = useMetrics({
    startDate: new Date(customer.created_at),
    endDate: new Date(),
    organization_id: organization.id,
    interval: 'month',
    customer_id: [customer.id],
  })

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="text-xl">Customer Details</h2>
      <Link
        href={`/dashboard/${organization.slug}/customers/${customer.id}`}
        className="flex flex-row items-center gap-4"
      >
        <Avatar
          avatar_url={customer.avatar_url}
          name={customer.name || customer.email}
          className="h-16 w-16"
        />
        <div className="flex flex-col gap-1">
          <p className="text-lg">
            {(customer.name?.length ?? 0) > 0 ? customer.name : '—'}
          </p>
          <div className="dark:text-polar-500 flex flex-row items-center gap-1 font-mono text-sm text-gray-500">
            {customer.email}
          </div>
        </div>
      </Link>
      <div className="flex flex-row justify-between gap-4">
        <CustomerStatBox title="Cumulative Revenue">
          <AmountLabel
            amount={
              metrics.data?.periods[metrics.data.periods.length - 1]
                .cumulative_revenue ?? 0
            }
            currency="USD"
          />
        </CustomerStatBox>
        <CustomerStatBox title="First Seen">
          <FormattedDateTime datetime={customer.created_at} />
        </CustomerStatBox>
      </div>
      <div className="flex flex-col gap-4">
        {customerSession ? (
          <CopyToClipboardInput
            value={`${CONFIG.FRONTEND_BASE_URL}/${organization.slug}/portal?customer_session_token=${customerSession.token}`}
            buttonLabel="Copy"
            className="bg-white"
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Customer Portal Link was copied to clipboard`,
              })
            }}
          />
        ) : (
          <Button
            className="w-full"
            size="lg"
            loading={customerSessionLoading}
            onClick={createCustomerSession}
          >
            Generate Customer Portal
          </Button>
        )}
        <div className="flex flex-row gap-4">
          <a
            href={`mailto:${customer.email}`}
            className="w-1/2 text-blue-500 dark:text-blue-400"
          >
            <Button className="w-full" size="lg" variant="secondary">
              Send Email
            </Button>
          </a>
          <Button
            className="w-1/2"
            size="lg"
            variant="secondary"
            onClick={showModal}
          >
            Edit
          </Button>
        </div>

        {customerSessionError && (
          <p className="text-destructive-foreground text-sm">
            {customerSessionError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <DetailRow label="ID" value={customer.id} />
          <DetailRow label="Email" value={customer.email} />
          <DetailRow label="Name" value={customer.name} />
          <DetailRow label="Tax ID" value={customer.tax_id} />
          <DetailRow
            label="Created At"
            value={<FormattedDateTime datetime={customer.created_at} />}
          />
        </div>
        <h4 className="text-lg">Billing Address</h4>
        <div className="flex flex-col">
          <DetailRow label="Line 1" value={customer.billing_address?.line1} />
          <DetailRow label="Line 2" value={customer.billing_address?.line2} />
          <DetailRow label="City" value={customer.billing_address?.city} />
          <DetailRow label="State" value={customer.billing_address?.state} />
          <DetailRow
            label="Postal Code"
            value={customer.billing_address?.postal_code}
          />
          <DetailRow
            label="Country"
            value={customer.billing_address?.country}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between gap-2">
          <h3 className="text-lg">Metadata</h3>
          <Button className="h-8 w-8" variant="secondary" onClick={showModal}>
            <AddOutlined />
          </Button>
        </div>
        {Object.entries(customer.metadata).map(([key, value]) => (
          <DetailRow
            key={key}
            label={key}
            value={value}
            valueClassName="dark:bg-polar-800 bg-gray-100"
          />
        ))}
      </div>
      <InlineModal
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          <EditCustomerModal customer={customer} onClose={hideModal} />
        }
      />
    </div>
  )
}
