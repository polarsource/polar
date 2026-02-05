import { useAccountCredits, useOrganizationAccount } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { useContext } from 'react'
import { InlineModal } from '../Modal/InlineModal'

export const FeeCreditGrantsModal = ({
  isShown,
  hide,
}: {
  isShown: boolean
  hide: () => void
}) => {
  const { organization } = useContext(OrganizationContext)
  const {
    data: account,
    isLoading: accountIsLoading,
    error: accountError,
  } = useOrganizationAccount(organization.id)

  const hasCredits = account?.credit_balance && account.credit_balance > 0

  const { data: credits, isLoading: isLoadingCredits } = useAccountCredits(
    hasCredits ? account?.id : undefined,
  )

  if (!account) {
    return null
  }

  return (
    <InlineModal
      isShown={isShown}
      hide={hide}
      modalContent={
        <div className="flex flex-col gap-8 px-8 py-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl">Fee Credit Grants</h1>
            <p className="dark:text-polar-500 text-gray-500">
              Fee Credits are usually granted for promotional, paid campaigns,
              or other purposes.
            </p>
          </div>
          {credits?.length && credits.length > 0 ? (
            <List className="flex flex-col" size="small">
              {credits
                ?.sort(
                  (a, b) =>
                    new Date(b.granted_at).getTime() -
                    new Date(a.granted_at).getTime(),
                )
                .map((credit) => (
                  <ListItem key={credit.id} className="p-4" size="small">
                    <div className="flex flex-row items-baseline gap-4">
                      <h2>{credit.title}</h2>
                      <span className="dark:text-polar-500 text-gray-500">
                        {new Date(credit.granted_at).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </span>
                    </div>
                    <span>
                      {formatCurrency('accounting')(credit.amount, 'usd')}
                    </span>
                  </ListItem>
                ))}
            </List>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 p-8">
              <p className="text-lg">No credits granted</p>
            </div>
          )}
        </div>
      }
    />
  )
}
