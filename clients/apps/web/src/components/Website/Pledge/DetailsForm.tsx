import { type PledgeResources } from 'polarkit/api/client'

const DetailsForm = ({
  setAmount,
  setEmail,
  minimumAmount,
}: PledgeResources & {
  setAmount: (amount: number) => void
  setEmail: (email: string) => void
  minimumAmount: number
}) => {
  const onAmountChange = (event) => {
    const amount = parseInt(event.target.value)
    setAmount(amount)
  }

  const onEmailChange = (event) => {
    setEmail(event.target.value)
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
            placeholder={minimumAmount}
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4">
            <span className="text-gray-500">$</span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-4">
            <span className="text-gray-500">USD</span>
          </div>
        </div>
        <p className="w-1/3 text-xs text-gray-500">
          Minimum is ${minimumAmount}
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
