import { Column, Heading, Hr, Row, Section } from '@react-email/components'
import type { schemas } from '../types'

interface OrderSummaryProps {
  order: schemas['OrderEmail']
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100) // Convert from cents
}

const OrderSummary = ({ order }: OrderSummaryProps) => {
  return (
    <Section>
      <Heading as="h2" className="text-lg font-bold">
        Order summary
      </Heading>
      {/* Invoice Details */}
      <Row className="mb-6">
        <Column className="w-1/2">
          <span className="mb-1 block text-sm text-gray-600">
            Invoice Number
          </span>
          <span className="text-sm font-medium text-gray-900">
            {order.invoice_number}
          </span>
        </Column>
        <Column className="w-1/2 text-right">
          <span className="mb-1 block text-sm text-gray-600">
            Date of Issue
          </span>
          <span className="text-sm font-medium text-gray-900">
            {new Date(order.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </Column>
      </Row>

      {/* Line Items Header */}
      <div className="border-t border-gray-200 pt-4">
        <Row className="mb-2 border-b border-gray-100 pb-2">
          <Column className="w-2/5">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-700">
              Description
            </span>
          </Column>
          <Column className="w-1/5 text-right">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-700">
              Quantity
            </span>
          </Column>
          <Column className="w-1/5 text-right">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-700">
              Unit Price
            </span>
          </Column>
          <Column className="w-1/5 text-right">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-700">
              Amount
            </span>
          </Column>
        </Row>

        {/* Line Items */}
        {order.items.map((item, index) => (
          <Row key={item.id || index} className="mb-1">
            <Column className="w-2/5">
              <span className="text-sm text-gray-900">{item.label}</span>
              {item.proration && (
                <span className="block text-xs text-gray-500">
                  (Prorated charge)
                </span>
              )}
            </Column>
            <Column className="w-1/5 text-right">
              <span className="text-sm text-gray-900">1</span>
            </Column>
            <Column className="w-1/5 text-right">
              <span className="text-sm text-gray-900">
                {formatCurrency(item.amount, order.currency)}
              </span>
            </Column>
            <Column className="w-1/5 text-right">
              <span className="text-sm text-gray-900">
                {formatCurrency(item.amount, order.currency)}
              </span>
            </Column>
          </Row>
        ))}
      </div>

      <Hr className="my-6" />

      {/* Totals Section */}
      <div className="ml-auto max-w-xs">
        {/* Subtotal */}
        <Row className="mb-1">
          <Column className="w-3/4">
            <span className="text-sm font-medium text-gray-900">Subtotal</span>
          </Column>
          <Column className="w-1/4 text-right">
            <span className="text-sm text-gray-900">
              {formatCurrency(order.subtotal_amount, order.currency)}
            </span>
          </Column>
        </Row>

        {/* Discount */}
        {order.discount_amount > 0 && (
          <Row className="mb-1">
            <Column className="w-3/4">
              <span className="text-sm font-medium text-gray-900">
                Discount
              </span>
            </Column>
            <Column className="w-1/4 text-right">
              <span className="text-sm text-gray-900">
                -{formatCurrency(order.discount_amount, order.currency)}
              </span>
            </Column>
          </Row>
        )}

        {/* Tax */}
        {order.tax_amount > 0 && (
          <Row className="mb-1">
            <Column className="w-3/4">
              <span className="text-sm font-medium text-gray-900">Tax</span>
            </Column>
            <Column className="w-1/4 text-right">
              <span className="text-sm text-gray-900">
                {formatCurrency(order.tax_amount, order.currency)}
              </span>
            </Column>
          </Row>
        )}

        {/* Total */}
        <Row className="mb-1">
          <Column className="w-3/4">
            <span className="text-sm font-bold text-gray-900">Total</span>
          </Column>
          <Column className="w-1/4 text-right">
            <span className="text-sm font-bold text-gray-900">
              {formatCurrency(order.total_amount, order.currency)}
            </span>
          </Column>
        </Row>

        {/* Applied Balance */}
        {order.applied_balance_amount !== 0 && (
          <Row className="mb-1">
            <Column className="w-3/4">
              <span className="text-sm font-medium text-gray-900">
                Applied balance
              </span>
            </Column>
            <Column className="w-1/4 text-right">
              <span className="text-sm text-gray-900">
                {formatCurrency(order.applied_balance_amount, order.currency)}
              </span>
            </Column>
          </Row>
        )}

        {/* Amount Due / To be paid */}
        {order.due_amount !== order.total_amount && (
          <Row className="mt-1">
            <Column className="w-3/4">
              <span className="text-sm font-bold text-gray-900">
                To be paid
              </span>
            </Column>
            <Column className="w-1/4 text-right">
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(order.due_amount, order.currency)}
              </span>
            </Column>
          </Row>
        )}
      </div>
    </Section>
  )
}

export default OrderSummary
