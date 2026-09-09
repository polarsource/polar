export type BillingOwner = 'stripe' | 'polar' | 'unknown'

export type SubscriptionCategory =
  | 'clean'
  | 'customer'
  | 'identity'
  | 'product'
  | 'payment'
  | 'lifecycle'
  | 'pricing'
  | 'cutover'

export type SubscriptionStatus =
  | 'ready'
  | 'action_required'
  | 'blocked'
  | 'cutover_hold'

export type PaymentReadiness = 'matching' | 'missing' | 'expired' | 'reentry'

export type IssueCode =
  | 'none'
  | 'customer_missing_country'
  | 'product_exists_in_polar'
  | 'customer_stripe_id_conflict'
  | 'missing_payment_method'
  | 'expired_card'
  | 'cancel_at_period_end'
  | 'multiple_line_items'
  | 'unsupported_quantity'
  | 'subscription_has_discount'
  | 'send_invoice_collection'
  | 'subscription_not_importable'
  | 'customer_missing_email'
  | 'renewal_inside_safety_window'
  | 'plan_changed_after_assessment'
  | 'customer_already_subscribed'
  | 'payment_method_requires_reentry'

export interface MockSubscriptionRecord {
  id: string
  customerLabel: string
  customerEmail: string | null
  productName: string
  planLabel: string
  amountCents: number
  currency: string
  cadence: 'month' | 'year'
  category: SubscriptionCategory
  status: SubscriptionStatus
  issueCode: IssueCode
  title: string
  detail: string
  recommendedAction: string
  billingOwner: BillingOwner
  paymentReadiness: PaymentReadiness
  canarySelectable: boolean
}
