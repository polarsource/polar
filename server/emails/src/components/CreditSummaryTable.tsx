import { Section } from 'react-email'
import { Text } from './foundation'

interface CreditSummaryTableProps {
  formatted_amount: string
  organization_name: string
}

export function CreditSummaryTable({
  formatted_amount,
  organization_name,
}: CreditSummaryTableProps) {
  return (
    <Section className="mt-6">
      <table className="w-full rounded-lg border border-gray-200">
        <tbody>
          <tr className="border-b border-gray-200 bg-gray-50">
            <td className="p-4">
              <Text variant="detail" weight="semibold" noMargin>
                Credit Amount
              </Text>
            </td>
            <td className="p-4 text-right">
              <Text variant="detail" weight="semibold" align="right" noMargin>
                {formatted_amount}
              </Text>
            </td>
          </tr>
          <tr>
            <td className="p-4">
              <Text variant="caption" noMargin>
                Organization
              </Text>
            </td>
            <td className="p-4 text-right">
              <Text variant="detail" align="right" noMargin>
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
