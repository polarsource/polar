import { CustomerSessionCode } from './customer_session_code'
import { EmailUpdate } from './email_update'
import { LoginCode } from './login_code'
import { MagicLink } from './magic_link'
import { OAuth2LeakedClient } from './oauth2_leaked_client'
import { OAuth2LeakedToken } from './oauth2_leaked_token'
import { OrderConfirmation } from './order_confirmation'
import { OrganizationAccessTokenLeaked } from './organization_access_token_leaked'
import { PersonalAccessTokenLeaked } from './personal_access_token_leaked'
import { SubscriptionCancellation } from './subscription_cancellation'
import { SubscriptionConfirmation } from './subscription_confirmation'
import { SubscriptionRevoked } from './subscription_revoked'
import { SubscriptionUncanceled } from './subscription_uncanceled'

const TEMPLATES: Record<string, React.FC<any>> = {
  magic_link: MagicLink,
  login_code: LoginCode,
  customer_session_code: CustomerSessionCode,
  email_update: EmailUpdate,
  oauth2_leaked_client: OAuth2LeakedClient,
  oauth2_leaked_token: OAuth2LeakedToken,
  order_confirmation: OrderConfirmation,
  organization_access_token_leaked: OrganizationAccessTokenLeaked,
  personal_access_token_leaked: PersonalAccessTokenLeaked,
  subscription_cancellation: SubscriptionCancellation,
  subscription_confirmation: SubscriptionConfirmation,
  subscription_revoked: SubscriptionRevoked,
  subscription_uncanceled: SubscriptionUncanceled,
}

export default TEMPLATES
