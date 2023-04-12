import { PledgeRead } from 'polarkit/api/client'
import { useBackofficeAllPledges } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'

const Pledges = () => {
  const pledges = useBackofficeAllPledges()
  const data = pledges.data
  return (
    <>
      <table className="min-w-full divide-y divide-gray-300">
        <thead>
          <tr>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Pledger
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              State
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Amount
            </th>
            <th
              scope="col"
              className="relative whitespace-nowrap py-3.5 pl-3 pr-4 sm:pr-0"
            >
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data && data.map((p) => <PledgeItem pledge={p} key={p.id} />)}
        </tbody>
      </table>
    </>
  )
}

export default Pledges

const PledgeItem = ({ pledge }: { pledge: PledgeRead }) => {
  return (
    <tr>
      <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-gray-900">
        <div className="flex items-center space-x-1">
          <img className="h-6 w-6" src={pledge.pledger_avatar} />
          <a href={`https://github.com/${pledge.pledger_name}`}>
            {pledge.pledger_name}
          </a>
        </div>
      </td>
      <td>{pledge.state}</td>
      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
        ${getCentsInDollarString(pledge.amount)}
      </td>
      <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
        {pledge.state === 'pending' && (
          <a href="#" className="text-indigo-600 hover:text-indigo-900">
            Approve
          </a>
        )}
      </td>
    </tr>
  )
}
