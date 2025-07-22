import { useMetrics } from '@/hooks/queries/metrics'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { AddOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { PropsWithChildren, useCallback, useState } from 'react'
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
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerContextView = ({
  organization,
  customer,
}: CustomerContextViewProps) => {
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
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      <ShadowBox className="dark:border-polar-800 flex flex-col gap-6 border-gray-200 bg-white p-6 md:shadow-sm lg:rounded-2xl">
        <Link
          href={`/dashboard/${organization.slug}/customers?customerId=${customer.id}&query=${customer.email}`}
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
              {customer.deleted_at && (
                <Pill className="ml-2 text-xs" color="red">
                  Deleted
                </Pill>
              )}
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
        {!customer.deleted_at && (
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
        )}
      </ShadowBox>
      <ShadowBox className="dark:border-polar-800 flex flex-col gap-4 border-gray-200 bg-white p-6 md:gap-0 md:shadow-sm lg:rounded-2xl">
        {!customer.deleted_at && (
          <DetailRow
            labelClassName="flex-none basis-24"
            label="ID"
            value={customer.id}
          />
        )}
        <DetailRow
          labelClassName="flex-none basis-24"
          label="Email"
          value={customer.email}
        />
        <DetailRow
          labelClassName="flex-none basis-24"
          label="Name"
          value={customer.name}
        />
        <DetailRow
          labelClassName="flex-none basis-24"
          label="Tax ID"
          value={customer.tax_id}
        />
        <DetailRow
          labelClassName="flex-none basis-24"
          label="Created At"
          value={<FormattedDateTime datetime={customer.created_at} />}
        />
      </ShadowBox>
      <ShadowBox className="dark:border-polar-800 flex flex-col gap-4 border-gray-200 bg-white p-6 md:shadow-sm lg:rounded-2xl">
        <h4 className="text-lg">Billing Address</h4>
        <div className="flex flex-col gap-4 md:gap-0">
          <DetailRow
            labelClassName="flex-none basis-24"
            label="Line 1"
            value={customer.billing_address?.line1}
          />
          <DetailRow
            labelClassName="flex-none basis-24"
            label="Line 2"
            value={customer.billing_address?.line2}
          />
          <DetailRow
            labelClassName="flex-none basis-24"
            label="City"
            value={customer.billing_address?.city}
          />
          <DetailRow
            labelClassName="flex-none basis-24"
            label="State"
            value={customer.billing_address?.state}
          />
          <DetailRow
            labelClassName="flex-none basis-24"
            label="Postal Code"
            value={customer.billing_address?.postal_code}
          />
          <DetailRow
            labelClassName="flex-none basis-24"
            label="Country"
            value={customer.billing_address?.country}
          />
        </div>
      </ShadowBox>
      {!customer.deleted_at && (
        <ShadowBox className="dark:border-polar-800 flex flex-col gap-4 border-gray-200 bg-white p-6 md:shadow-sm lg:rounded-2xl">
          <div className="flex flex-row items-center justify-between gap-2">
            <h3 className="text-lg">Metadata</h3>
            <Button className="h-8 w-8" variant="secondary" onClick={showModal}>
              <AddOutlined />
            </Button>
          </div>
          {Object.entries(customer.metadata).map(([key, value]) => (
            <DetailRow key={key} label={key} value={value} />
          ))}
        </ShadowBox>
      )}
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
