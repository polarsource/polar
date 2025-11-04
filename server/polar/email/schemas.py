import json
import sys
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Discriminator, TypeAdapter

from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    MaintainerNewProductSaleNotificationPayload,
)
from polar.order.schemas import OrderBase, OrderItemSchema
from polar.organization.schemas import Organization
from polar.product.schemas import BenefitList, ProductBase
from polar.subscription.schemas import SubscriptionBase


class EmailTemplate(StrEnum):
    login_code = "login_code"
    customer_session_code = "customer_session_code"
    email_update = "email_update"
    oauth2_leaked_client = "oauth2_leaked_client"
    oauth2_leaked_token = "oauth2_leaked_token"
    order_confirmation = "order_confirmation"
    organization_access_token_leaked = "organization_access_token_leaked"
    organization_invite = "organization_invite"
    organization_account_unlink = "organization_account_unlink"
    organization_under_review = "organization_under_review"
    organization_reviewed = "organization_reviewed"
    personal_access_token_leaked = "personal_access_token_leaked"
    seat_invitation = "seat_invitation"
    subscription_cancellation = "subscription_cancellation"
    subscription_confirmation = "subscription_confirmation"
    subscription_cycled = "subscription_cycled"
    subscription_past_due = "subscription_past_due"
    subscription_revoked = "subscription_revoked"
    subscription_uncanceled = "subscription_uncanceled"
    subscription_updated = "subscription_updated"
    webhook_endpoint_disabled = "webhook_endpoint_disabled"
    notification_new_sale = "notification_new_sale"
    notification_new_subscription = "notification_new_subscription"
    notification_create_account = "notification_create_account"


class SubscriptionEmail(SubscriptionBase): ...


class ProductEmail(ProductBase):
    benefits: BenefitList


class OrderEmail(OrderBase):
    description: str
    items: list[OrderItemSchema]


class EmailProps(BaseModel):
    email: str


class LoginCodeProps(EmailProps):
    code: str
    code_lifetime_minutes: int


class LoginCodeEmail(BaseModel):
    template: Literal[EmailTemplate.login_code] = EmailTemplate.login_code
    props: LoginCodeProps


class CustomerSessionCodeProps(EmailProps):
    organization: Organization
    code: str
    code_lifetime_minutes: int
    url: str


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


class OrganizationUnderReviewProps(EmailProps):
    organization: Organization


class OrganizationUnderReviewEmail(BaseModel):
    template: Literal[EmailTemplate.organization_under_review] = (
        EmailTemplate.organization_under_review
    )
    props: OrganizationUnderReviewProps


class OrganizationReviewedProps(EmailProps):
    organization: Organization


class OrganizationReviewedEmail(BaseModel):
    template: Literal[EmailTemplate.organization_reviewed] = (
        EmailTemplate.organization_reviewed
    )
    props: OrganizationReviewedProps


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


class SubscriptionPastDueProps(SubscriptionPropsBase):
    payment_url: str | None = None


class SubscriptionPastDueEmail(BaseModel):
    template: Literal[EmailTemplate.subscription_past_due] = (
        EmailTemplate.subscription_past_due
    )
    props: SubscriptionPastDueProps


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


class NotificationCreateAccountEmail(BaseModel):
    template: Literal[EmailTemplate.notification_create_account] = (
        EmailTemplate.notification_create_account
    )
    props: MaintainerCreateAccountNotificationPayload


class OrganizationAccountUnlinkProps(EmailProps):
    organization_kept_name: str
    organizations_unlinked: list[str]


class OrganizationAccountUnlinkEmail(BaseModel):
    template: Literal[EmailTemplate.organization_account_unlink] = (
        EmailTemplate.organization_account_unlink
    )
    props: OrganizationAccountUnlinkProps


Email = Annotated[
    LoginCodeEmail
    | CustomerSessionCodeEmail
    | EmailUpdateEmail
    | OAuth2LeakedClientEmail
    | OAuth2LeakedTokenEmail
    | OrderConfirmationEmail
    | OrganizationAccessTokenLeakedEmail
    | OrganizationInviteEmail
    | OrganizationAccountUnlinkEmail
    | OrganizationUnderReviewEmail
    | OrganizationReviewedEmail
    | PersonalAccessTokenLeakedEmail
    | SeatInvitationEmail
    | SubscriptionCancellationEmail
    | SubscriptionConfirmationEmail
    | SubscriptionCycledEmail
    | SubscriptionPastDueEmail
    | SubscriptionRevokedEmail
    | SubscriptionUncanceledEmail
    | SubscriptionUpdatedEmail
    | WebhookEndpointDisabledEmail
    | NotificationNewSaleEmail
    | NotificationNewSubscriptionEmail
    | NotificationCreateAccountEmail,
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
