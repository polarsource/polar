import { Hr, Img, Section, Text } from 'react-email'

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
        <Text className="my-0 mb-2 text-base font-semibold text-gray-900">
          Order Summary
        </Text>
        <table className="w-full">
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
                <Text className="m-0 text-sm font-medium text-gray-900">
                  {product_name}
                </Text>
                <Text className="m-0 text-sm text-gray-500">
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
          <Text className="m-0 text-sm font-semibold text-gray-900">
            Order Type
          </Text>
          <Text className="m-0 text-sm text-gray-600">
            {formatted_billing_reason}
          </Text>
        </Section>
      )}
      <Section className="mt-4 mb-6">
        <Text className="m-0 text-sm font-semibold text-gray-900">
          Customer
        </Text>
        {customer_name && (
          <Text className="m-0 text-sm text-gray-600">{customer_name}</Text>
        )}
        {customer_email && (
          <Text className="m-0 text-sm text-gray-600">{customer_email}</Text>
        )}
        {formatted_address && (
          <Text className="m-0 text-sm text-gray-600">{formatted_address}</Text>
        )}
        {formatted_address_country && (
          <Text className="m-0 text-sm text-gray-600">
            {formatted_address_country}
          </Text>
        )}
      </Section>
    </>
  )
}

export default SaleSummary
