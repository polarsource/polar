import { api } from 'polarkit'
import { AccountType, Platforms } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'

const StripeOnboardingButton = ({ stripeId }: { stripeId?: string }) => {
  const currentOrg = useStore((store) => store.currentOrg)
  const onboard = async () => {
    let stripeAccountId = stripeId
    if (!stripeId) {
      const account = await api.accounts.createAccount({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        requestBody: { account_type: AccountType.STRIPE },
      })
      stripeAccountId = account.stripe_id
    }
    const link = await api.accounts.onboardingLink({
      platform: Platforms.GITHUB,
      orgName: currentOrg.name,
      stripeId: stripeAccountId,
    })
    window.location.href = link.url
  }

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        onboard()
      }}
    >
      {stripeId ? 'Finish Stripe onboarding' : 'Sign up with Stripe'}
    </a>
  )
}

export default StripeOnboardingButton
