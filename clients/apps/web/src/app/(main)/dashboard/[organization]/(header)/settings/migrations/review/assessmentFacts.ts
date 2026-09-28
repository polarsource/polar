import { automaticTaxLabel, intervalLabel, renewalDate } from '../recordFormat'
import { ReviewRow, rowAmount } from './reviewRows'

export function assessmentFacts(row: ReviewRow) {
  const amount = rowAmount(row)
  return {
    email: row.customer_email || row.title,
    price: amount?.money ?? null,
    interval: intervalLabel(row),
    renewal: renewalDate(row),
    status: row.subtitle,
    automaticTax: automaticTaxLabel(row),
    sourceId: row.source_id,
    productId: row.product_source_id,
    customerId: row.customer_source_id,
    customerName: row.customer_name,
    productName: row.product_name,
    failed: row.import_status === 'failed',
    showProduct:
      Boolean(row.product_name) ||
      row.reason_code === 'subscription_product_not_importable',
    isSubscription: row.entity === 'subscriptions',
  }
}
