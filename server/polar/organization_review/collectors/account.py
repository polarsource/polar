from polar.models.account import Account

from ..schemas import AccountData


def collect_account_data(account: Account | None) -> AccountData:
    if account is None:
        return AccountData()

    identity_status = None
    if account.admin is not None:
        identity_status = account.admin.identity_verification_status.value

    return AccountData(
        country=account.country,
        currency=account.currency,
        business_type=account.business_type,
        is_details_submitted=account.is_details_submitted,
        is_charges_enabled=account.is_charges_enabled,
        is_payouts_enabled=account.is_payouts_enabled,
        identity_verification_status=identity_status,
    )
