import DollarSignIcon from '@/components/Icons/DollarSignIcon'
import Icon from '@/components/Icons/Icon'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { OrganizationPrivateRead } from 'polarkit/api/client'
import { PolarTimeAgo } from 'polarkit/components/ui'
import { useListPledgesForOrganization } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { classNames } from 'polarkit/utils'

const Transactions = (props: { org: OrganizationPrivateRead }) => {
  const { org } = props

  const transactions = useListPledgesForOrganization(org.platform, org.name)

  return (
    <DashboardLayout isPersonalDashboard={false}>
      <div className="flex justify-between space-x-8">
        <HeaderPill title="Current peldges" amount={60000} active={true} />
        <HeaderPill
          title={`Rewarded to ${org.name}`}
          amount={82250}
          active={false}
        />
        <HeaderPill
          title="Rewarded to contributors"
          amount={69250}
          active={false}
        />
      </div>
      <div>
        <h2>Pledges on open issues</h2>
        <table className="w-full text-left">
          <thead className="bg-white">
            <tr>
              <th
                scope="col"
                className="relative isolate py-3.5 pr-3 text-left text-sm font-semibold text-gray-900"
              >
                Issue
              </th>
              <th
                scope="col"
                className="relative isolate py-3.5 pr-3 text-left text-sm font-semibold text-gray-900"
              >
                Pledge date
              </th>
              <th
                scope="col"
                className="relative isolate py-3.5 pr-3 text-left text-sm font-semibold text-gray-900"
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.data &&
              transactions.data.map((t) => (
                <tr key={t.pledge.id}>
                  <td className="flex items-center space-x-2 px-2 py-2 text-sm text-gray-500">
                    <Icon
                      classes="bg-blue-200 text-blue-600"
                      icon={<DollarSignIcon />}
                    />
                    <a href="#" className="text-blue-600">
                      {t.organization?.name}/{t.repository?.name}#
                      {t.issue?.number}
                    </a>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    <PolarTimeAgo date={new Date(t.pledge.created_at)} />
                  </td>
                  <td className="px-3 py-4 text-right text-sm text-gray-500">
                    ${getCentsInDollarString(t.pledge.amount, true)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}

const HeaderPill = (props: {
  title: string
  amount: number
  active: boolean
}) => {
  return (
    <div
      className={classNames(
        props.active ? 'bg-white shadow' : 'border bg-gray-200',
        'flex-1 rounded-md py-4 px-6',
      )}
    >
      <div className="text-lg font-medium text-gray-500">{props.title}</div>
      <div className="text-2xl font-medium text-gray-900">
        ${getCentsInDollarString(props.amount, true)}
      </div>
    </div>
  )
}

export default Transactions
