import { api } from 'polarkit'
import { AccountType, Platforms } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'

const StripeSignupButton = () => {
  const currentOrg = useStore((store) => store.currentOrg)
  const signup = async () => {
    const account = await api.accounts.createAccount({
      platform: Platforms.GITHUB,
      orgName: currentOrg.name,
      requestBody: { account_type: AccountType.STRIPE },
    })
    const link = await api.accounts.createLink({
      platform: Platforms.GITHUB,
      orgName: currentOrg.name,
      stripeId: account.stripe_id,
    })
    window.location.href = link.url
  }

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        signup()
      }}
    >
      Sign up with Stripe
    </a>
  )
}

export default StripeSignupButton
