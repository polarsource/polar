import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { api } from 'polarkit'
import { type PledgeRead, type PledgeResources } from 'polarkit/api/client'
import PrimaryButton from 'polarkit/components/ui/PrimaryButton'
import { CONFIG } from 'polarkit/config'
import { useState } from 'react'
import DetailsForm from './DetailsForm'
import PaymentForm from './PaymentForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)

const PledgeForm = ({
  organization,
  repository,
  issue,
  query,
}: PledgeResources & {
  query: any // TODO: Investigate & fix type
}) => {
  const [pledge, setPledge] = useState<PledgeRead | null>(null)
  const [amount, setAmountState] = useState(0)
  const [email, setEmailState] = useState('')

  const MINIMUM_PLEDGE = CONFIG.MINIMUM_PLEDGE_AMOUNT

  const validateEmail = (email) => {
    return email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)
  }

  const shouldSynchronizePledge = () => {
    if (amount < MINIMUM_PLEDGE) {
      return false
    }

    if (!pledge) {
      return true
    }

    if (!validateEmail(email)) {
      return false
    }

    return pledge.amount !== amount || pledge.email !== email
  }

  const createPledge = async () => {
    if (!shouldSynchronizePledge()) {
      return false
    }

    return await api.pledges.createPledge({
      platform: organization.platform,
      orgName: organization.name,
      repoName: repository.name,
      requestBody: {
        issue_id: issue.id,
        amount: amount,
        email: email,
      },
    })
  }

  const updatePledge = async () => {
    if (!shouldSynchronizePledge()) {
      return false
    }

    return await api.pledges.updatePledge({
      platform: organization.platform,
      orgName: organization.name,
      repoName: repository.name,
      pledgeId: pledge.id,
      requestBody: {
        amount: amount,
        email: email,
      },
    })
  }

  const synchronizePledge = async () => {
    let updatedPledge: PledgeRead
    if (!pledge) {
      updatedPledge = await createPledge()
    } else {
      updatedPledge = await updatePledge()
    }

    if (updatedPledge) {
      setPledge(updatedPledge)
    }
  }

  const setAmount = (amount: number) => {
    setAmountState(amount)
    synchronizePledge()
  }

  const setEmail = (email: string) => {
    setEmailState(email)
    synchronizePledge()
  }

  return (
    <>
      <form className="flex flex-col">
        <DetailsForm
          setAmount={setAmount}
          setEmail={setEmail}
          minimumAmount={MINIMUM_PLEDGE}
        />
        {pledge && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: pledge.client_secret,
            }}
          >
            <PaymentForm pledge={pledge} />
          </Elements>
        )}

        {/*
         * Unfortunately, we need to have this button (disabled) by default and then
         * remove it once Stripe is initiated. Since we cannot (in an easy/nice way)
         * manage the submission outside of the Stripe Elements context.
         */}
        {!pledge && (
          <div className="mt-6">
            <PrimaryButton disabled={true}>Pledge $0</PrimaryButton>
          </div>
        )}
      </form>
    </>
  )
}
export default PledgeForm
