import json
import sys
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    Discriminator,
    TypeAdapter,
    computed_field,
)

from polar.benefit.schemas import Benefit
from polar.kit.currency import format_currency
from polar.kit.visibility import Visibility
from polar.notifications.notification import (
    MaintainerAccountCreditsGrantedNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
)
from polar.order.schemas import OrderBase, OrderItemSchema
from polar.organization.schemas import Organization
from polar.product.schemas import BenefitList, ProductBase
from polar.subscription.schemas import SubscriptionBase


class EmailTemplate(StrEnum):
    login_code = "login_code"
    customer_email_changed_notification = "customer_email_changed_notification"
    customer_email_update_verification = "customer_email_update_verification"
    customer_session_code = "customer_session_code"
    email_update = "email_update"
    email_update_already_registered = "email_update_already_registered"
    oauth2_leaked_client = "oauth2_leaked_client"
    oauth2_leaked_token = "oauth2_leaked_token"
    order_confirmation = "order_confirmation"
    organization_access_token_leaked = "organization_access_token_leaked"
    organization_invite = "organization_invite"
    organization_offboarded = "organization_offboarded"
    support_case_organization_new_message = "support_case_organization_new_message"
    personal_access_token_leaked = "personal_access_token_leaked"
    seat_invitation = "seat_invitation"
    subscription_cancellation = "subscription_cancellation"
    subscription_confirmation = "subscription_confirmation"
    subscription_cycled = "subscription_cycled"
    subscription_cycled_after_trial = "subscription_cycled_after_trial"
    subscription_final_invoice = "subscription_final_invoice"
    subscription_past_due = "subscription_past_due"
    subscription_revoked = "subscription_revoked"
    subscription_uncanceled = "subscription_uncanceled"
    subscription_renewal_reminder = "subscription_renewal_reminder"
    subscription_trial_conversion_reminder = "subscription_trial_conversion_reminder"
    subscription_updated = "subscription_updated"
    webhook_endpoint_disabled = "webhook_endpoint_disabled"
    notification_new_sale = "notification_new_sale"
    notification_new_subscription = "notification_new_subscription"
    notification_credits_granted = "notification_credits_granted"
    chargeback_prevention_refund = "chargeback_prevention_refund"
    polar_self_subscription_cancellation = "polar_self_subscription_cancellation"
    polar_self_subscription_confirmation = "polar_self_subscription_confirmation"
    polar_self_subscription_cycled = "polar_self_subscription_cycled"
    polar_self_subscription_past_due = "polar_self_subscription_past_due"
    polar_self_subscription_revoked = "polar_self_subscription_revoked"
    polar_self_startup_program_welcome = "polar_self_startup_program_welcome"


class SubscriptionEmail(SubscriptionBase): ...


def _filter_email_benefit_list(benefits: list[Benefit]) -> list[Benefit]:
    return [benefit for benefit in benefits if benefit.visibility == Visibility.public]


EmailBenefitList = Annotated[
    BenefitList,
    AfterValidator(_filter_email_benefit_list),
]


class ProductEmail(ProductBase):
    benefits: EmailBenefitList


class OrderEmail(OrderBase):
    description: str
    items: list[OrderItemSchema]


class EmailProps(BaseModel):
    email: str


class LoginCodeProps(EmailProps):
    code: str
    code_lifetime_minutes: int
    domain: str


class LoginCodeEmail(BaseModel):
    template: Literal[EmailTemplate.login_code] = EmailTemplate.login_code
    props: LoginCodeProps


class CustomerSessionCodeProps(EmailProps):
    organization: Organization
    code: str
    code_lifetime_minutes: int
    url: str
    domain: str


class CustomerSessionCodeEmail(BaseModel):
    template: Literal[EmailTemplate.customer_session_code] = (
        EmailTemplate.customer_session_code
    )
    props: CustomerSessionCodeProps


class EmailUpdateProps(EmailProps):
    token_lifetime_minutes: int
    url: str


class EmailUpdateEmail(BaseModel):
    template: Literal[EmailTemplate.email_update] = EmailTemplate.email_update
    props: EmailUpdateProps


class EmailUpdateAlreadyRegisteredProps(EmailProps): ...


class EmailUpdateAlreadyRegisteredEmail(BaseModel):
    template: Literal[EmailTemplate.email_update_already_registered] = (
        EmailTemplate.email_update_already_registered
    )
    props: EmailUpdateAlreadyRegisteredProps


class CustomerEmailUpdateVerificationProps(EmailProps):
    organization_name: str
    token_lifetime_minutes: int
    url: str


class CustomerEmailUpdateVerificationEmail(BaseModel):
    template: Literal[EmailTemplate.customer_email_update_verification] = (
        EmailTemplate.customer_email_update_verification
    )
    props: CustomerEmailUpdateVerificationProps


class CustomerEmailChangedNotificationProps(EmailProps):
    organization_name: str
    new_email: str


class CustomerEmailChangedNotificationEmail(BaseModel):
    template: Literal[EmailTemplate.customer_email_changed_notification] = (
        EmailTemplate.customer_email_changed_notification
    )
    props: CustomerEmailChangedNotificationProps


class OAuth2LeakedClientProps(EmailProps):
    token_type: str
    client_name: str
    notifier: str
    url: str


class OAuth2LeakedClientEmail(BaseModel):
    template: Literal[EmailTemplate.oauth2_leaked_client] = (
        EmailTemplate.oauth2_leaked_client
    )
    props: OAuth2LeakedClientProps


class OAuth2LeakedTokenProps(EmailProps):
    client_name: str
    notifier: str
    url: str


class OAuth2LeakedTokenEmail(BaseModel):
    template: Literal[EmailTemplate.oauth2_leaked_token] = (
        EmailTemplate.oauth2_leaked_token
    )
    props: OAuth2LeakedTokenProps


class OrderConfirmationProps(EmailProps):
    organization: Organization
    product: ProductEmail | None
    order: OrderEmail
    url: str


class OrderConfirmationEmail(BaseModel):
    template: Literal[EmailTemplate.order_confirmation] = (
        EmailTemplate.order_confirmation
    )
    props: OrderConfirmationProps


class OrganizationAccessTokenLeakedProps(EmailProps):
    organization_access_token: str
    notifier: str
    url: str


class OrganizationAccessTokenLeakedEmail(BaseModel):
    template: Literal[EmailTemplate.organization_access_token_leaked] = (
        EmailTemplate.organization_access_token_leaked
    )
    props: OrganizationAccessTokenLeakedProps


class OrganizationInviteProps(EmailProps):
    organization_name: str
    inviter_email: str
    invite_url: str


class OrganizationInviteEmail(BaseModel):
    template: Literal[EmailTemplate.organization_invite] = (
        EmailTemplate.organization_invite
    )
    props: OrganizationInviteProps


class SupportCaseOrganizationNewMessageProps(EmailProps):
    organization_name: str
    # Recipient-facing label for the case type (e.g. "appeal"), so the copy
    # stays generic across support-case types.
    case_label: str
    url: str


class SupportCaseOrganizationNewMessageEmail(BaseModel):
    template: Literal[EmailTemplate.support_case_organization_new_message] = (
        EmailTemplate.support_case_organization_new_message
    )
    props: SupportCaseOrganizationNewMessageProps


class PersonalAccessTokenLeakedProps(EmailProps):
    personal_access_token: str
    notifier: str
    url: str


class PersonalAccessTokenLeakedEmail(BaseModel):
    template: Literal[EmailTemplate.personal_access_token_leaked] = (
        EmailTemplate.personal_access_token_leaked
    )
    props: PersonalAccessTokenLeakedProps


class SeatInvitationProps(EmailProps):
    organization: Organization
    product_name: str
    billing_manager_email: str
    claim_url: str


class SeatInvitationEmail(BaseModel):
    template: Literal[EmailTemplate.seat_invitation] = EmailTemplate.seat_invitation
    props: SeatInvitationProps


class SubscriptionPropsBase(EmailProps):
    organization: Organization
    product: ProductEmail
    subscription: SubscriptionEmail
    url: str


class SubscriptionCancellationProps(SubscriptionPropsBase): ...


class SubscriptionCancellationEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_cancellation] = (
        EmailTemplate.subscription_cancellation
    )
    props: SubscriptionCancellationProps


class SubscriptionConfirmationProps(SubscriptionPropsBase):
    order: OrderEmail


class SubscriptionConfirmationEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_confirmation] = (
        EmailTemplate.subscription_confirmation
    )
    props: SubscriptionConfirmationProps


class SubscriptionCycledProps(SubscriptionPropsBase):
    order: OrderEmail


class SubscriptionCycledEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_cycled] = (
        EmailTemplate.subscription_cycled
    )
    props: SubscriptionCycledProps


class SubscriptionCycledAfterTrialProps(SubscriptionPropsBase):
    order: OrderEmail


class SubscriptionCycledAfterTrialEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_cycled_after_trial] = (
        EmailTemplate.subscription_cycled_after_trial
    )
    props: SubscriptionCycledAfterTrialProps


class SubscriptionFinalInvoiceProps(SubscriptionPropsBase):
    order: OrderEmail


class SubscriptionFinalInvoiceEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_final_invoice] = (
        EmailTemplate.subscription_final_invoice
    )
    props: SubscriptionFinalInvoiceProps


class SubscriptionPastDueProps(SubscriptionPropsBase):
    payment_url: str | None = None


class SubscriptionPastDueEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_past_due] = (
        EmailTemplate.subscription_past_due
    )
    props: SubscriptionPastDueProps


class SubscriptionRenewalReminderProps(SubscriptionPropsBase):
    renewal_date: str


class SubscriptionRenewalReminderEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_renewal_reminder] = (
        EmailTemplate.subscription_renewal_reminder
    )
    props: SubscriptionRenewalReminderProps


class SubscriptionTrialConversionReminderProps(SubscriptionPropsBase):
    conversion_date: str


class SubscriptionTrialConversionReminderEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_trial_conversion_reminder] = (
        EmailTemplate.subscription_trial_conversion_reminder
    )
    props: SubscriptionTrialConversionReminderProps


class SubscriptionRevokedProps(SubscriptionPropsBase): ...


class SubscriptionRevokedEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_revoked] = (
        EmailTemplate.subscription_revoked
    )
    props: SubscriptionRevokedProps


class SubscriptionUncanceledProps(SubscriptionPropsBase): ...


class SubscriptionUncanceledEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_uncanceled] = (
        EmailTemplate.subscription_uncanceled
    )
    props: SubscriptionUncanceledProps


class SubscriptionUpdatedProps(SubscriptionPropsBase):
    order: OrderEmail | None


class SubscriptionUpdatedEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_updated] = (
        EmailTemplate.subscription_updated
    )
    props: SubscriptionUpdatedProps


class WebhookEndpointDisabledProps(EmailProps):
    organization: Organization
    webhook_endpoint_url: str
    dashboard_url: str


class WebhookEndpointDisabledEmail(BaseModel):
    template: Literal[EmailTemplate.webhook_endpoint_disabled] = (
        EmailTemplate.webhook_endpoint_disabled
    )
    props: WebhookEndpointDisabledProps


class NotificationNewSaleEmail(BaseModel):
    template: Literal[EmailTemplate.notification_new_sale] = (
        EmailTemplate.notification_new_sale
    )
    props: MaintainerNewProductSaleNotificationPayload


class NotificationNewSubscriptionEmail(BaseModel):
    template: Literal[EmailTemplate.notification_new_subscription] = (
        EmailTemplate.notification_new_subscription
    )
    props: MaintainerNewPaidSubscriptionNotificationPayload


class NotificationCreditsGrantedEmail(BaseModel):
    template: Literal[EmailTemplate.notification_credits_granted] = (
        EmailTemplate.notification_credits_granted
    )
    props: MaintainerAccountCreditsGrantedNotificationPayload


class ChargebackPreventionRefundProps(EmailProps):
    order_number: str
    customer_name: str
    amount: int
    currency: str = "usd"
    refund_date: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def formatted_amount(self) -> str:
        return format_currency(self.amount, self.currency)


class ChargebackPreventionRefundEmail(BaseModel):
    template: Literal[EmailTemplate.chargeback_prevention_refund] = (
        EmailTemplate.chargeback_prevention_refund
    )
    props: ChargebackPreventionRefundProps


class PolarSelfSubscriptionConfirmationProps(EmailProps):
    product_name: str


class PolarSelfSubscriptionConfirmationEmail(BaseModel):
    template: Literal[EmailTemplate.polar_self_subscription_confirmation] = (
        EmailTemplate.polar_self_subscription_confirmation
    )
    props: PolarSelfSubscriptionConfirmationProps


class PolarSelfSubscriptionCycledProps(EmailProps):
    product_name: str


class PolarSelfSubscriptionCycledEmail(BaseModel):
    template: Literal[EmailTemplate.polar_self_subscription_cycled] = (
        EmailTemplate.polar_self_subscription_cycled
    )
    props: PolarSelfSubscriptionCycledProps


class PolarSelfSubscriptionCancellationProps(EmailProps):
    product_name: str
    ends_at: str | None = None


class PolarSelfSubscriptionCancellationEmail(BaseModel):
    template: Literal[EmailTemplate.polar_self_subscription_cancellation] = (
        EmailTemplate.polar_self_subscription_cancellation
    )
    props: PolarSelfSubscriptionCancellationProps


class PolarSelfSubscriptionPastDueProps(EmailProps):
    product_name: str


class PolarSelfSubscriptionPastDueEmail(BaseModel):
    template: Literal[EmailTemplate.polar_self_subscription_past_due] = (
        EmailTemplate.polar_self_subscription_past_due
    )
    props: PolarSelfSubscriptionPastDueProps


class PolarSelfSubscriptionRevokedProps(EmailProps):
    product_name: str


class PolarSelfSubscriptionRevokedEmail(BaseModel):
    template: Literal[EmailTemplate.polar_self_subscription_revoked] = (
        EmailTemplate.polar_self_subscription_revoked
    )
    props: PolarSelfSubscriptionRevokedProps


class PolarSelfStartupProgramWelcomeProps(EmailProps):
    organization_name: str
    billing_url: str


class PolarSelfStartupProgramWelcomeEmail(BaseModel):
    template: Literal[EmailTemplate.polar_self_startup_program_welcome] = (
        EmailTemplate.polar_self_startup_program_welcome
    )
    props: PolarSelfStartupProgramWelcomeProps


class OrganizationOffboardedProps(EmailProps):
    organization_name: str
    account_url: str


class OrganizationOffboardedEmail(BaseModel):
    template: Literal[EmailTemplate.organization_offboarded] = (
        EmailTemplate.organization_offboarded
    )
    props: OrganizationOffboardedProps


Email = Annotated[
    LoginCodeEmail
    | CustomerEmailChangedNotificationEmail
    | CustomerEmailUpdateVerificationEmail
    | CustomerSessionCodeEmail
    | EmailUpdateEmail
    | EmailUpdateAlreadyRegisteredEmail
    | OAuth2LeakedClientEmail
    | OAuth2LeakedTokenEmail
    | OrderConfirmationEmail
    | OrganizationAccessTokenLeakedEmail
    | OrganizationInviteEmail
    | OrganizationOffboardedEmail
    | SupportCaseOrganizationNewMessageEmail
    | PersonalAccessTokenLeakedEmail
    | SeatInvitationEmail
    | SubscriptionCancellationEmail
    | SubscriptionConfirmationEmail
    | SubscriptionCycledEmail
    | SubscriptionCycledAfterTrialEmail
    | SubscriptionFinalInvoiceEmail
    | SubscriptionPastDueEmail
    | SubscriptionRenewalReminderEmail
    | SubscriptionTrialConversionReminderEmail
    | SubscriptionRevokedEmail
    | SubscriptionUncanceledEmail
    | SubscriptionUpdatedEmail
    | WebhookEndpointDisabledEmail
    | NotificationNewSaleEmail
    | NotificationNewSubscriptionEmail
    | NotificationCreditsGrantedEmail
    | ChargebackPreventionRefundEmail
    | PolarSelfSubscriptionCancellationEmail
    | PolarSelfSubscriptionConfirmationEmail
    | PolarSelfSubscriptionCycledEmail
    | PolarSelfSubscriptionPastDueEmail
    | PolarSelfSubscriptionRevokedEmail
    | PolarSelfStartupProgramWelcomeEmail,
    Discriminator("template"),
]

EmailAdapter: TypeAdapter[Email] = TypeAdapter(Email)


if __name__ == "__main__":
    openapi_schema = {
        "openapi": "3.1.0",
        "paths": {},
        "components": {
            "schemas": EmailAdapter.json_schema(
                mode="serialization", ref_template="#/components/schemas/{model}"
            )["$defs"]
        },
    }
    sys.stdout.write(json.dumps(openapi_schema, indent=2))
