import { ChargebackPreventionRefund } from './chargeback_prevention_refund'
import { CustomerEmailChangedNotification } from './customer_email_changed_notification'
import { CustomerEmailUpdateVerification } from './customer_email_update_verification'
import { CustomerSessionCode } from './customer_session_code'
import { EmailUpdate } from './email_update'
import { LoginCode } from './login_code'
import { NotificationCreditsGranted } from './notification_credits_granted'
import { NotificationNewSale } from './notification_new_sale'
import { NotificationNewSubscription } from './notification_new_subscription'
import { OAuth2LeakedClient } from './oauth2_leaked_client'
import { OAuth2LeakedToken } from './oauth2_leaked_token'
import { OrderConfirmation } from './order_confirmation'
import { OrganizationAccessTokenLeaked } from './organization_access_token_leaked'
import { OrganizationAccountUnlink } from './organization_account_unlink'
import { OrganizationInvite } from './organization_invite'
import { OrganizationOffboarded } from './organization_offboarded'
import { PersonalAccessTokenLeaked } from './personal_access_token_leaked'
import { PolarSelfStartupProgramWelcome } from './polar_self_startup_program_welcome'
import { PolarSelfSubscriptionCancellation } from './polar_self_subscription_cancellation'
import { PolarSelfSubscriptionConfirmation } from './polar_self_subscription_confirmation'
import { PolarSelfSubscriptionCycled } from './polar_self_subscription_cycled'
import { PolarSelfSubscriptionPastDue } from './polar_self_subscription_past_due'
import { PolarSelfSubscriptionRevoked } from './polar_self_subscription_revoked'
import { SeatInvitation } from './seat_invitation'
import { SubscriptionCancellation } from './subscription_cancellation'
import { SubscriptionConfirmation } from './subscription_confirmation'
import { SubscriptionCycled } from './subscription_cycled'
import { SubscriptionCycledAfterTrial } from './subscription_cycled_after_trial'
import { SubscriptionFinalInvoice } from './subscription_final_invoice'
import { SubscriptionPastDue } from './subscription_past_due'
import { SubscriptionRenewalReminder } from './subscription_renewal_reminder'
import { SubscriptionRevoked } from './subscription_revoked'
import { SubscriptionTrialConversionReminder } from './subscription_trial_conversion_reminder'
import { SubscriptionUncanceled } from './subscription_uncanceled'
import { SubscriptionUpdated } from './subscription_updated'
import { SupportCaseOrganizationNewMessage } from './support_case_organization_new_message'
import { WebhookEndpointDisabled } from './webhook_endpoint_disabled'

const TEMPLATES: Record<string, React.FC<never>> = {
  login_code: LoginCode,
  customer_email_changed_notification: CustomerEmailChangedNotification,
  customer_email_update_verification: CustomerEmailUpdateVerification,
  customer_session_code: CustomerSessionCode,
  email_update: EmailUpdate,
  oauth2_leaked_client: OAuth2LeakedClient,
  oauth2_leaked_token: OAuth2LeakedToken,
  order_confirmation: OrderConfirmation,
  organization_access_token_leaked: OrganizationAccessTokenLeaked,
  organization_account_unlink: OrganizationAccountUnlink,
  organization_invite: OrganizationInvite,
  organization_offboarded: OrganizationOffboarded,
  personal_access_token_leaked: PersonalAccessTokenLeaked,
  seat_invitation: SeatInvitation,
  subscription_cancellation: SubscriptionCancellation,
  subscription_confirmation: SubscriptionConfirmation,
  subscription_cycled: SubscriptionCycled,
  subscription_cycled_after_trial: SubscriptionCycledAfterTrial,
  subscription_final_invoice: SubscriptionFinalInvoice,
  subscription_past_due: SubscriptionPastDue,
  subscription_renewal_reminder: SubscriptionRenewalReminder,
  subscription_revoked: SubscriptionRevoked,
  subscription_trial_conversion_reminder: SubscriptionTrialConversionReminder,
  subscription_uncanceled: SubscriptionUncanceled,
  subscription_updated: SubscriptionUpdated,
  support_case_organization_new_message: SupportCaseOrganizationNewMessage,
  webhook_endpoint_disabled: WebhookEndpointDisabled,
  notification_new_sale: NotificationNewSale,
  notification_new_subscription: NotificationNewSubscription,
  notification_credits_granted: NotificationCreditsGranted,
  chargeback_prevention_refund: ChargebackPreventionRefund,
  polar_self_subscription_cancellation: PolarSelfSubscriptionCancellation,
  polar_self_subscription_confirmation: PolarSelfSubscriptionConfirmation,
  polar_self_subscription_cycled: PolarSelfSubscriptionCycled,
  polar_self_subscription_past_due: PolarSelfSubscriptionPastDue,
  polar_self_subscription_revoked: PolarSelfSubscriptionRevoked,
  polar_self_startup_program_welcome: PolarSelfStartupProgramWelcome,
}

export default TEMPLATES
