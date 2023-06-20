import TopbarPill from '@/components/Shared/TopbarPill'
import { api } from 'polarkit'
import { Platforms } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'

const StripeOnboardingButton = ({
  stripeId,
  showSetupAccount,
}: {
  stripeId?: string
  showSetupAccount: (_: boolean) => void
}) => {
  const currentOrg = useStore((store) => store.currentOrg)
  const onboard = async () => {
    if (!currentOrg) {
      return
    }

    if (!stripeId) {
      showSetupAccount(true)
    } else {
      const link = await api.accounts.onboardingLink({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        stripeId,
      })
      window.location.href = link.url
    }
  }

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        onboard()
      }}
    >
      <TopbarPill color="blue">
        <span>
          {stripeId ? 'Finish Stripe onboarding' : 'Sign up with Stripe'}
        </span>
      </TopbarPill>
    </a>
  )
}

export default StripeOnboardingButton
