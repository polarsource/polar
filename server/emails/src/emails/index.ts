import { CustomerSessionCode } from './customer_session_code'
import { EmailUpdate } from './email_update'
import { LoginCode } from './login_code'
import { NotificationCreateAccount } from './notification_create_account'
import { NotificationNewSale } from './notification_new_sale'
import { NotificationNewSubscription } from './notification_new_subscription'
import { OAuth2LeakedClient } from './oauth2_leaked_client'
import { OAuth2LeakedToken } from './oauth2_leaked_token'
import { OrderConfirmation } from './order_confirmation'
import { OrganizationAccessTokenLeaked } from './organization_access_token_leaked'
import { OrganizationAccountUnlink } from './organization_account_unlink'
import { OrganizationInvite } from './organization_invite'
import OrganizationReviewed from './organization_reviewed'
import { OrganizationUnderReview } from './organization_under_review'
import { PersonalAccessTokenLeaked } from './personal_access_token_leaked'
import { SeatInvitation } from './seat_invitation'
import { SubscriptionCancellation } from './subscription_cancellation'
import { SubscriptionConfirmation } from './subscription_confirmation'
import { SubscriptionCycled } from './subscription_cycled'
import { SubscriptionPastDue } from './subscription_past_due'
import { SubscriptionRevoked } from './subscription_revoked'
import { SubscriptionUncanceled } from './subscription_uncanceled'
import { SubscriptionUpdated } from './subscription_updated'
import { WebhookEndpointDisabled } from './webhook_endpoint_disabled'

const TEMPLATES: Record<string, React.FC<any>> = {
  login_code: LoginCode,
  customer_session_code: CustomerSessionCode,
  email_update: EmailUpdate,
  oauth2_leaked_client: OAuth2LeakedClient,
  oauth2_leaked_token: OAuth2LeakedToken,
  order_confirmation: OrderConfirmation,
  organization_access_token_leaked: OrganizationAccessTokenLeaked,
  organization_account_unlink: OrganizationAccountUnlink,
  organization_invite: OrganizationInvite,
  organization_under_review: OrganizationUnderReview,
  organization_reviewed: OrganizationReviewed,
  personal_access_token_leaked: PersonalAccessTokenLeaked,
  seat_invitation: SeatInvitation,
  subscription_cancellation: SubscriptionCancellation,
  subscription_confirmation: SubscriptionConfirmation,
  subscription_cycled: SubscriptionCycled,
  subscription_past_due: SubscriptionPastDue,
  subscription_revoked: SubscriptionRevoked,
  subscription_uncanceled: SubscriptionUncanceled,
  subscription_updated: SubscriptionUpdated,
  webhook_endpoint_disabled: WebhookEndpointDisabled,
  notification_new_sale: NotificationNewSale,
  notification_new_subscription: NotificationNewSubscription,
  notification_create_account: NotificationCreateAccount,
}

export default TEMPLATES
