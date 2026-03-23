from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.models.user import IdentityVerificationStatus
from polar.organization_review.collectors.identity import collect_identity_data
from polar.organization_review.schemas import IdentityData


def _build_account(
    *,
    verification_status: IdentityVerificationStatus = IdentityVerificationStatus.verified,
    verification_id: str | None = "vs_test_123",
) -> MagicMock:
    admin = MagicMock()
    admin.identity_verification_status = verification_status
    admin.identity_verification_id = verification_id

    account = MagicMock()
    account.admin = admin
    return account


def _build_verification_session(
    data: dict[str, object],
) -> stripe_lib.identity.VerificationSession:
    return stripe_lib.identity.VerificationSession.construct_from(data, None)


@pytest.mark.asyncio
class TestCollectIdentityData:
    async def test_none_account(self) -> None:
        result = await collect_identity_data(None)
        assert result == IdentityData()

    async def test_account_without_admin(self) -> None:
        account = MagicMock()
        account.admin = None
        result = await collect_identity_data(account)
        assert result == IdentityData()

    async def test_no_verification_id(self) -> None:
        account = _build_account(verification_id=None)
        result = await collect_identity_data(account)
        assert result.verification_status == "verified"
        assert result.verified_first_name is None

    async def test_verified_outputs_missing(self, mocker: MockerFixture) -> None:
        """Regression test for SERVER-44D: verified_outputs absent from Stripe response."""
        account = _build_account()
        vs = _build_verification_session(
            {
                "id": "vs_test_123",
                "object": "identity.verification_session",
                "status": "verified",
                "last_error": None,
                # verified_outputs intentionally omitted
            }
        )
        mocker.patch(
            "polar.organization_review.collectors.identity.stripe_service.get_verification_session",
            return_value=vs,
        )

        result = await collect_identity_data(account)

        assert result.verification_status == "verified"
        assert result.verification_error_code is None
        assert result.verified_first_name is None
        assert result.verified_last_name is None
        assert result.verified_address_country is None
        assert result.verified_dob is None

    async def test_verified_outputs_present(self, mocker: MockerFixture) -> None:
        account = _build_account()
        vs = _build_verification_session(
            {
                "id": "vs_test_123",
                "object": "identity.verification_session",
                "status": "verified",
                "last_error": None,
                "verified_outputs": {
                    "first_name": "Jane",
                    "last_name": "Doe",
                    "address": {"country": "US"},
                    "dob": {"year": 1990, "month": 3, "day": 15},
                },
            }
        )
        mocker.patch(
            "polar.organization_review.collectors.identity.stripe_service.get_verification_session",
            return_value=vs,
        )

        result = await collect_identity_data(account)

        assert result.verification_status == "verified"
        assert result.verified_first_name == "Jane"
        assert result.verified_last_name == "Doe"
        assert result.verified_address_country == "US"
        assert result.verified_dob == "1990-03-15"

    async def test_verified_outputs_without_address_or_dob(
        self, mocker: MockerFixture
    ) -> None:
        account = _build_account()
        vs = _build_verification_session(
            {
                "id": "vs_test_123",
                "object": "identity.verification_session",
                "status": "verified",
                "last_error": None,
                "verified_outputs": {
                    "first_name": "Jane",
                    "last_name": "Doe",
                    "address": None,
                    "dob": None,
                },
            }
        )
        mocker.patch(
            "polar.organization_review.collectors.identity.stripe_service.get_verification_session",
            return_value=vs,
        )

        result = await collect_identity_data(account)

        assert result.verified_first_name == "Jane"
        assert result.verified_last_name == "Doe"
        assert result.verified_address_country is None
        assert result.verified_dob is None

    async def test_last_error_present(self, mocker: MockerFixture) -> None:
        account = _build_account(verification_status=IdentityVerificationStatus.failed)
        vs = _build_verification_session(
            {
                "id": "vs_test_123",
                "object": "identity.verification_session",
                "status": "requires_input",
                "last_error": {
                    "code": "document_expired",
                    "reason": "The document has expired.",
                },
            }
        )
        mocker.patch(
            "polar.organization_review.collectors.identity.stripe_service.get_verification_session",
            return_value=vs,
        )

        result = await collect_identity_data(account)

        assert result.verification_status == "failed"
        assert result.verification_error_code == "document_expired"

    async def test_stripe_error_handled(self, mocker: MockerFixture) -> None:
        account = _build_account()
        mocker.patch(
            "polar.organization_review.collectors.identity.stripe_service.get_verification_session",
            side_effect=stripe_lib.StripeError("API error"),
        )

        result = await collect_identity_data(account)

        assert result.verification_status == "verified"
        assert result.verified_first_name is None
