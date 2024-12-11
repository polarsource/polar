import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { buildAPI } from '@/utils/api'
import { CheckoutPublic } from '@polar-sh/sdk'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { BenefitGrant } from '../Benefit/BenefitGrant'

interface CheckoutBenefitsProps {
  checkout: CheckoutPublic
  customerSessionToken?: string
}

const CheckoutBenefits = ({
  checkout,
  customerSessionToken,
}: CheckoutBenefitsProps) => {
  const api = buildAPI({ token: customerSessionToken })
  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    checkoutId: checkout.id,
  })

  return (
    <>
      <div className="flex flex-col gap-4">
        <List>
          {benefitGrants?.items.map((benefitGrant) => (
            <ListItem
              key={benefitGrant.id}
              // selected={benefit.id === selectedBenefit?.id}
              // onSelect={() => setSelectedBenefit(benefit)}
            >
              <BenefitGrant api={api} benefitGrant={benefitGrant} />
            </ListItem>
          ))}
        </List>
      </div>
    </>
  )
}

export default CheckoutBenefits
