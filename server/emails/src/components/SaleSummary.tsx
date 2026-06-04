import { Hr, Img, Section } from 'react-email'
import { Text } from './foundation'

interface SaleSummaryProps {
  product_name: string
  product_image_url?: string | null
  formatted_price_amount: string
  formatted_billing_reason?: string | null
  customer_name?: string | null
  customer_email?: string | null
  formatted_address?: string | null
  formatted_address_country?: string | null
}

export function SaleSummary({
  product_name,
  product_image_url,
  formatted_price_amount,
  formatted_billing_reason,
  customer_name,
  customer_email,
  formatted_address,
  formatted_address_country,
}: SaleSummaryProps) {
  return (
    <>
      <Hr className="my-6 border-gray-200" />
      <Section>
        <Text variant="body" weight="semibold" noMargin>
          Order Summary
        </Text>
        <table className="mt-4 w-full">
          <tbody>
            <tr>
              {product_image_url && (
                <td className="w-[72px] pr-3 align-top">
                  <Img
                    src={product_image_url}
                    width={64}
                    height={64}
                    className="rounded-lg border border-gray-200"
                  />
                </td>
              )}
              <td className="align-middle">
                <Text variant="detail" weight="medium" noMargin>
                  {product_name}
                </Text>
                <Text variant="caption" noMargin>
                  {formatted_price_amount}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
      <Hr className="my-6 border-gray-200" />
      {formatted_billing_reason && (
        <Section>
          <Text variant="detail" weight="semibold" noMargin>
            Order Type
          </Text>
          <Text variant="caption" noMargin>
            {formatted_billing_reason}
          </Text>
        </Section>
      )}
      <Section className="mt-4 mb-6">
        <Text variant="detail" weight="semibold" noMargin>
          Customer
        </Text>
        {customer_name && (
          <Text variant="caption" noMargin>
            {customer_name}
          </Text>
        )}
        {customer_email && (
          <Text variant="caption" noMargin>
            {customer_email}
          </Text>
        )}
        {formatted_address && (
          <Text variant="caption" noMargin>
            {formatted_address}
          </Text>
        )}
        {formatted_address_country && (
          <Text variant="caption" noMargin>
            {formatted_address_country}
          </Text>
        )}
      </Section>
    </>
  )
}

export default SaleSummary
