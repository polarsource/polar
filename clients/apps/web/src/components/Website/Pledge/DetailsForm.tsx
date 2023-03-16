import { api } from 'polarkit'
import { type PledgeRead, type PledgeResources } from 'polarkit/api/client'
import { useState } from 'react'

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
        <label htmlFor="amount">Choose amount to pledge</label>
        <div className="flex flex-row items-center space-x-4">
          <input
            type="number"
            id="amount"
            placeholder="50"
            min="50"
            onChange={onAmountChange}
          />
          <p>Minimum is $50</p>
        </div>

        <label htmlFor="email">Contact details</label>
        <input type="email" id="email" onChange={onEmailChange} />

        <button type="submit">Submit</button>
      </form>
    </>
  )
}
export default DetailsForm
