import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { Customer, CustomerSession } from '@polar-sh/api'
import Avatar from '@polar-sh/ui/components/atoms/avatar'
import Button from '@polar-sh/ui/components/atoms/button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/copy-to-clipboard-input'
import FormattedDateTime from '@polar-sh/ui/components/atoms/formatted-date-time'
import Link from 'next/link'
import { PropsWithChildren, useCallback, useContext, useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
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
  customer: Customer
}

export const CustomerContextView = ({ customer }: CustomerContextViewProps) => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const { isShown: isModalShown, show: showModal, hide: hideModal } = useModal()

  const [customerSessionLoading, setCustomerSessionLoading] = useState(false)
  const [customerSessionError, setCustomerSessionError] = useState<
    string | null
  >(null)
  const [customerSession, setCustomerSession] =
    useState<CustomerSession | null>(null)
  const createCustomerSession = useCallback(async () => {
    setCustomerSessionLoading(true)
    try {
      const session = await api.customerSessions.create({
        body: { customer_id: customer.id },
      })
      setCustomerSession(session)
    } catch {
      setCustomerSessionError(
        'An error occurred while creating the customer portal link. Please try again later.',
      )
    } finally {
      setCustomerSessionLoading(false)
    }
  }, [customer])

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
          <p className="text-lg">{customer.email}</p>
          <div className="dark:text-polar-500 flex flex-row items-center gap-1 font-mono text-xs text-gray-500">
            {customer.id}
          </div>
        </div>
      </Link>
      <div className="flex flex-row justify-between gap-4">
        <CustomerStatBox title="Name">
          <span className="flex-wrap text-sm">
            {(customer.name?.length ?? 0) > 0 ? customer.name : '—'}
          </span>
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
