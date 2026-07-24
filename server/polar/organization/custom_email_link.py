from urllib.parse import urlencode

from polar.config import settings
from polar.models import Customer, Organization


def get_custom_email_link_url(
    organization: Organization,
    customer: Customer,
    recipient_email: str,
    token: str,
) -> str | None:
    """Build the organization's custom email link, if one is configured.

    Returns None when the organization uses the default Polar customer portal
    links. The token is short-lived and may be either a customer or a member
    session token depending on the recipient.
    """
    override_url = (
        organization.customer_email_link_url
        # Deprecated: legacy env-var overrides, kept as a fallback until the
        # remaining configured organization is migrated to the DB setting.
        or settings.CUSTOMER_PORTAL_URL_OVERRIDES.get(str(organization.id))
    )
    if not override_url:
        return None
    params = {"email": recipient_email}
    if customer.external_id is not None:
        params["external_id"] = customer.external_id
    params["customer_session_token"] = token
    return f"{override_url}?{urlencode(params)}"
