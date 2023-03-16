import { api } from 'polarkit'
import { type PledgeRead, type PledgeResources } from 'polarkit/api/client'
import { useState } from 'react'

import PrimaryButton from 'polarkit/components/ui/PrimaryButton'

const DetailsForm = ({
  organization,
  repository,
  issue,
  setPledge,
}: PledgeResources & {
  setPledge: (pledge: PledgeRead) => void
}) => {
  const [amount, setAmount] = useState(0)
  const [email, setEmail] = useState('')

  const createPledge = async () => {
    const pledge = await api.pledges.createPledge({
      platform: organization.platform,
      orgName: organization.name,
      repoName: repository.name,
      requestBody: {
        issue_id: issue.id,
        amount: amount,
        email: email,
      },
    })
    setPledge(pledge)
  }

  const onAmountChange = (e) => {
    setAmount(parseInt(e.target.value))
  }

  const onEmailChange = (e) => {
    setEmail(e.target.value)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    createPledge()
  }

  return (
    <>
      <form className="flex flex-col" onSubmit={onSubmit}>
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
              placeholder="50"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4">
              <span className="text-gray-500">$</span>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-4">
              <span className="text-gray-500">USD</span>
            </div>
          </div>
          <p className="w-1/3 text-xs text-gray-500">Minimum is $50</p>
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
          className="block w-full rounded-md border-gray-200 py-3 px-4 text-sm shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
        />

        <div className="mt-6">
          <PrimaryButton>Submit</PrimaryButton>
        </div>
      </form>
    </>
  )
}
export default DetailsForm
