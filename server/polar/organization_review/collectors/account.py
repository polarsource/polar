import structlog

from polar.models.account import Account

from ..schemas import AccountData

log = structlog.get_logger(__name__)


def collect_account_data(account: Account | None) -> AccountData:
    if account is None:
        return AccountData()

    data = account.data or {}

    requirements = data.get("requirements") or {}
    requirements_errors = [
        {"code": e.get("code", ""), "reason": e.get("reason", "")}
        for e in (requirements.get("errors") or [])
        if e.get("code")
    ]

    business_profile = data.get("business_profile") or {}
    support_address = business_profile.get("support_address") or {}

    return AccountData(
        country=account.country,
        currency=account.currency,
        business_type=data.get("business_type") or "unknown",
        is_details_submitted=account.is_details_submitted,
        is_charges_enabled=account.is_charges_enabled,
        is_payouts_enabled=account.is_payouts_enabled,
        requirements_currently_due=requirements.get("currently_due") or [],
        requirements_past_due=requirements.get("past_due") or [],
        requirements_pending_verification=requirements.get("pending_verification") or [],
        requirements_disabled_reason=requirements.get("disabled_reason"),
        requirements_errors=requirements_errors,
        capabilities=data.get("capabilities") or {},
        business_name=business_profile.get("name"),
        business_url=business_profile.get("url"),
        business_support_address_country=support_address.get("country"),
    )
