import { Section, Text } from 'react-email'

export function CreditSummaryTable({
  formatted_amount,
  organization_name,
}: {
  formatted_amount: string
  organization_name: string
}) {
  return (
    <Section className="mt-6">
      <table className="w-full rounded-lg border border-gray-200">
        <tbody>
          <tr className="border-b border-gray-200 bg-gray-50">
            <td className="p-4">
              <Text className="m-0 text-sm font-semibold text-gray-900">
                Credit Amount
              </Text>
            </td>
            <td className="p-4 text-right">
              <Text className="m-0 text-sm font-semibold text-gray-900">
                {formatted_amount}
              </Text>
            </td>
          </tr>
          <tr>
            <td className="p-4">
              <Text className="m-0 text-sm text-gray-600">Organization</Text>
            </td>
            <td className="p-4 text-right">
              <Text className="m-0 text-sm text-gray-900">
                {organization_name}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

export default CreditSummaryTable
