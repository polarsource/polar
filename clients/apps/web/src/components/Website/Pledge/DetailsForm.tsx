import { api } from 'polarkit'
import { type PledgeRead, type PledgeResources } from 'polarkit/api/client'
import { CONFIG } from 'polarkit/config'
import { useState } from 'react'

const DetailsForm = ({
  organization,
  repository,
  issue,
  pledge,
  setPledge,
}: PledgeResources & {
  pledge?: PledgeRead
  setPledge: (pledge: PledgeRead) => void
}) => {
  const [amount, setAmount] = useState(0)
  const [email, setEmail] = useState('')

  const MINIMUM_PLEDGE = CONFIG.MINIMUM_PLEDGE_AMOUNT

  const validateEmail = (email) => {
    return email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)
  }

  const shouldSynchronizePledge = () => {
    if (amount < MINIMUM_PLEDGE) {
      return false
    }

    if (pledge) {
      if (!validateEmail(email)) {
        return false
      }

      return pledge.amount !== amount || pledge.email !== email
    }
    return true
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

  const onAmountChange = (e) => {
    setAmount(parseInt(e.target.value))
    synchronizePledge()
  }

  const onEmailChange = (e) => {
    const email = e.target.value
    setEmail(email)
    synchronizePledge()
  }

  return (
    <>
      <label htmlFor="amount" className="text-sm font-medium text-gray-600">
        Choose amount to pledge
      </label>
      <div className="mt-3 flex flex-row items-center space-x-4">
        <div className="relative w-2/3">
          <input
            type="text"
            id="amount"
            name="amount"
            className="block w-full rounded-md border-gray-200 py-3 px-4 pl-9 pr-16 text-sm shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
            onChange={onAmountChange}
            onBlur={onAmountChange}
            placeholder={MINIMUM_PLEDGE}
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4">
            <span className="text-gray-500">$</span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-4">
            <span className="text-gray-500">USD</span>
          </div>
        </div>
        <p className="w-1/3 text-xs text-gray-500">
          Minimum is ${MINIMUM_PLEDGE}
        </p>
      </div>

      <label
        htmlFor="email"
        className="mt-5 mb-2 text-sm font-medium text-gray-600"
      >
        Contact details
      </label>
      <input
        type="email"
        id="email"
        onChange={onEmailChange}
        onBlur={onEmailChange}
        className="block w-full rounded-md border-gray-200 py-3 px-4 text-sm shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
      />
    </>
  )
}
export default DetailsForm
