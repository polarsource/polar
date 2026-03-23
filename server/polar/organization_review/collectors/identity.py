import stripe as stripe_lib
import structlog

from polar.integrations.stripe.service import stripe as stripe_service
from polar.models.account import Account

from ..schemas import IdentityData

log = structlog.get_logger(__name__)


async def collect_identity_data(account: Account | None) -> IdentityData:
    if account is None or account.admin is None:
        return IdentityData()

    verification_status = account.admin.identity_verification_status.value
    verification_error_code = None
    verified_first_name = None
    verified_last_name = None
    verified_address_country = None
    verified_dob = None

    if account.admin.identity_verification_id is not None:
        try:
            vs = await stripe_service.get_verification_session(
                account.admin.identity_verification_id,
                expand=["verified_outputs"],
            )
            if vs.last_error and vs.last_error.code:
                verification_error_code = vs.last_error.code
            verified_outputs = getattr(vs, "verified_outputs", None)
            if verified_outputs:
                verified_first_name = getattr(verified_outputs, "first_name", None)
                verified_last_name = getattr(verified_outputs, "last_name", None)
                address = getattr(verified_outputs, "address", None)
                if address:
                    verified_address_country = address.country
                dob = getattr(verified_outputs, "dob", None)
                if dob and dob.year and dob.month and dob.day:
                    verified_dob = f"{dob.year}-{dob.month:02d}-{dob.day:02d}"
        except stripe_lib.StripeError:
            log.warning(
                "collect_identity_data.verification_session_fetch_failed",
                identity_verification_id=account.admin.identity_verification_id,
            )

    return IdentityData(
        verification_status=verification_status,
        verification_error_code=verification_error_code,
        verified_first_name=verified_first_name,
        verified_last_name=verified_last_name,
        verified_address_country=verified_address_country,
        verified_dob=verified_dob,
    )
