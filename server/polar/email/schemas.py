import json
import sys
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Discriminator, TypeAdapter

from polar.organization.schemas import Organization


class EmailTemplate(StrEnum):
    login_code = "login_code"
    customer_session_code = "customer_session_code"
    email_update = "email_update"
    oauth2_leaked_client = "oauth2_leaked_client"
    oauth2_leaked_token = "oauth2_leaked_token"
    order_confirmation = "order_confirmation"
    organization_access_token_leaked = "organization_access_token_leaked"
    organization_invite = "organization_invite"
    personal_access_token_leaked = "personal_access_token_leaked"
    seat_invitation = "seat_invitation"
    subscription_cancellation = "subscription_cancellation"
    subscription_confirmation = "subscription_confirmation"
    subscription_cycled = "subscription_cycled"
    subscription_past_due = "subscription_past_due"
    subscription_revoked = "subscription_revoked"
    subscription_uncanceled = "subscription_uncanceled"
    subscription_updated = "subscription_updated"
    notification_account_under_review = "notification_account_under_review"
    notification_account_reviewed = "notification_account_reviewed"
    notification_new_sale = "notification_new_sale"
    notification_new_subscription = "notification_new_subscription"
    notification_create_account = "notification_create_account"


class EmailProps(BaseModel): ...


class LoginCodeProps(EmailProps):
    code: str
    code_lifetime_minutes: int


class CustomerSessionCodeProps(EmailProps):
    organization: Organization
    code: str
    code_lifetime_minutes: int
    url: str


class LoginCodeEmail(BaseModel):
    template: Literal[EmailTemplate.login_code] = EmailTemplate.login_code
    props: LoginCodeProps


class CustomerSessionCodeEmail(BaseModel):
    template: Literal[EmailTemplate.customer_session_code] = (
        EmailTemplate.customer_session_code
    )
    props: CustomerSessionCodeProps


Email = Annotated[
    LoginCodeEmail | CustomerSessionCodeEmail,
    Discriminator("template"),
]

if __name__ == "__main__":
    EmailAdapter: TypeAdapter[Email] = TypeAdapter(Email)
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
